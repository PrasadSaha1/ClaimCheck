import json

import io

import math

import os

import re

from concurrent.futures import ThreadPoolExecutor

from datetime import datetime, timedelta



from django.http import FileResponse, JsonResponse
from django.contrib.auth.hashers import make_password, check_password
from django.db import IntegrityError, transaction
from django.db.models import Q

from django.core.files.uploadedfile import SimpleUploadedFile

from django.shortcuts import get_object_or_404

from django.utils import timezone

from django.views.decorators.csrf import ensure_csrf_cookie

from PIL import Image, ImageOps, UnidentifiedImageError



from . import ai

from .models import Claim, ClaimQuestion, DemoUser, FoundItem, ItemPhoto, LostReport, MatchScore, Notification

from .sites import DEFAULT_SITE, SITES, inside, site_json

from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.http import HttpResponseRedirect
from django.urls import reverse



CATEGORIES = {'Electronics', 'Wallet & keys', 'Clothing', 'Books', 'Other'}





def error(message, status=400):

    return JsonResponse({'error': message}, status=status)





def user_for(request):
    user_id = request.session.get("demo_user_id")

    if not user_id:
        return None

    return DemoUser.objects.filter(
        id=user_id,
        email_verified=True,
    ).first()



def payload(request):

    try:

        return json.loads(request.body or '{}')

    except (ValueError, UnicodeDecodeError):

        return {}





def site_for(data):

    site = data.get('site') or DEFAULT_SITE

    if site not in SITES:

        raise ValueError('Choose a location.')

    return site





def coordinates(data, site):

    try:

        lat, lng = float(data['latitude']), float(data['longitude'])

        if not inside(site, lat, lng):

            raise ValueError

        return lat, lng

    except (TypeError, ValueError, KeyError):

        raise ValueError(f'Choose a point on the {SITES[site]["short"]} map.')





def timestamp(value):

    try:

        result = datetime.fromisoformat(value.replace('Z', '+00:00'))

        return timezone.make_aware(result) if timezone.is_naive(result) else result

    except (AttributeError, ValueError):

        raise ValueError('Enter valid dates and times.')





def validate_photos(files, required=False):

    if required and not files:

        raise ValueError('Add at least one photo.')

    for file in files:

        if file.size > 5 * 1024 * 1024:

            raise ValueError('Each photo must be under 5 MB.')

        try:

            image = Image.open(file)

            image.verify()

            if image.format not in ('JPEG', 'PNG', 'WEBP'):

                raise ValueError('Use JPG, PNG, or WebP photos.')

            file.seek(0)

        except (UnidentifiedImageError, OSError):

            raise ValueError('One photo is not a valid image.')





def normalized_photos(files):

    # Re-encode uploads to drop EXIF (including possible GPS coordinates).

    clean = []

    for file in files:

        with Image.open(file) as image:

            output = io.BytesIO()

            image = ImageOps.exif_transpose(image).convert('RGB')

            image.thumbnail((1600, 1600))

            image.save(output, format='JPEG', quality=85)

        clean.append(SimpleUploadedFile('item.jpg', output.getvalue(), content_type='image/jpeg'))

    return clean





def photos_for(item, viewer):

    own = viewer and item.finder_id == viewer.id

    return [{'id': p.id, 'url': f'/api/photos/{p.id}/'} for p in item.photos.all() if own or p.public]





def item_json(item, viewer):

    own = viewer and item.finder_id == viewer.id

    approved = viewer and Claim.objects.filter(item=item, claimant=viewer, status='approved').exists()

    data = {'id': item.id, 'site': item.site, 'public_description': item.public_description, 'category': item.category,

            'latitude': item.latitude, 'longitude': item.longitude, 'found_at': item.found_at.isoformat(),

            'location_note': item.location_note, 'claim_question': item.claim_question,

            'status': item.status, 'ai_review': item.ai_review, 'photos': photos_for(item, viewer)}

    alt = viewer and not own and ClaimQuestion.objects.filter(item=item, claimant=viewer).first()

    if alt:

        data['claim_question'] = alt.question

    if own:

        data.update(secret_detail=item.secret_detail, description=item.description)

    if own or approved:

        data['holding_location'] = item.holding_location

        data['finder'] = {'name': item.finder.name, 'email': item.finder.email, 'phone': item.finder.phone}

    return data





def lost_json(report):

    return {'id': report.id, 'site': report.site, 'description': report.description, 'category': report.category,

            'latitude': report.latitude, 'longitude': report.longitude, 'radius_m': report.radius_m,

            'lost_after': report.lost_after.isoformat(), 'lost_before': report.lost_before.isoformat(),

            'status': report.status, 'created_at': report.created_at.isoformat(),

            'photos': [{'id': p.id, 'url': f'/api/photos/{p.id}/'} for p in report.photos.all()]}





def distance_m(a, b):

    lat1, lon1, lat2, lon2 = map(math.radians, (a.latitude, a.longitude, b.latitude, b.longitude))

    dlat, dlon = lat2 - lat1, lon2 - lon1

    return 12742000 * math.asin(math.sqrt(math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2))





TIME_GRACE = timedelta(hours=1)







FILLER = {'the', 'and', 'with', 'has', 'have', 'had', 'for', 'from', 'near', 'one', 'some', 'very', 'this',
          'that', 'its', 'was', 'are', 'were', 'lost', 'found', 'item', 'left', 'color', 'colored', 'size',
          'small', 'large', 'big', 'little', 'black', 'white', 'gray', 'grey', 'blue', 'red', 'green',
          'yellow', 'brown', 'pink', 'purple', 'orange', 'dark', 'light', 'campus', 'room', 'floor',
          'terminal', 'gate', 'station', 'platform', 'track'}


def words(text):

    """Distinctive words only. Filler and bare colors alone say nothing about which item it is."""

    return set(re.findall(r'[a-z0-9]{3,}', text.lower())) - FILLER







def match_parts(report, item):

    """How well a found item fits a lost report on text, place, and time, or None if it cannot be the same item."""

    if report.site != item.site:

        return None

    if item.found_at < report.lost_after - TIME_GRACE:

        return None  # Found before it was lost.

    # A t-shirt is not a laptop: two different real categories are never the same item.

    if report.category != item.category and 'Other' not in (report.category, item.category):

        return None

    days_late = (item.found_at - report.lost_before).total_seconds() / 86400

    time = 1 if days_late <= 2 else max(0, 1 - (days_late - 2) / 12)

    distance = distance_m(report, item)

    beyond = max(0, distance - report.radius_m)

    if beyond > 1500:

        return None

    shared = words(report.description) & words(item.description + ' ' + item.public_description)

    keyword = min(1, len(shared) / max(1, min(len(words(report.description)), 5)))

    semantic = ai.similarity(report.embedding, item.embedding)

    text = max(keyword, semantic)

    if text < .18:

        return None

    return {'text': text, 'location': 1 - beyond / 1500, 'time': time,

            'category': int(report.category == item.category), 'distance': distance}







def match_score(parts, photo):

    if photo is None:

        return .5 * parts['text'] + .25 * parts['location'] + .18 * parts['time'] + .07 * parts['category']

    return (.35 * parts['text'] + .25 * photo + .2 * parts['location'] + .15 * parts['time']

            + .05 * parts['category'])







def matches_for(report):

    photo_scores = dict(report.match_scores.values_list('item_id', 'photo_score'))

    matches = []

    for item in FoundItem.objects.filter(status='open', site=report.site).exclude(finder=report.owner).prefetch_related('photos'):

        parts = match_parts(report, item)

        if not parts:

            continue

        photo = photo_scores.get(item.id)

        if photo is not None and photo < .15:

            continue  # Gemini compared the photos and they show clearly different items.

        score = match_score(parts, photo)

        if score < .38:

            continue

        # Strong needs the descriptions themselves to agree, not just a nearby place and time, and photos must not disagree.

        strong = (score >= .68 and parts['text'] >= .5 and parts['category'] and parts['time'] >= .5
                  and parts['location'] >= .5 and (photo is None or photo >= .3))

        matches.append({'item': item_json(item, report.owner), 'score': round(score, 3),

                        'confidence': 'Strong match' if strong else 'Possible match',

                        'distance_m': round(parts['distance'])})

    return sorted(matches, key=lambda m: m['score'], reverse=True)[:10]







def candidate_pairs(reports, items):

    pairs = []

    for report in reports:

        for item in items:

            parts = report.owner_id != item.finder_id and match_parts(report, item)

            if parts:

                pairs.append((match_score(parts, None), report, item))

    return pairs







def ai_photos(photos):

    # Stored photos are already normalized JPEGs.

    files = []

    for photo in photos[:ai.MAX_AI_PHOTOS]:

        with photo.image.open('rb') as file:

            files.append(SimpleUploadedFile('item.jpg', file.read(), content_type='image/jpeg'))

    return files







def score_photos(pairs, limit=5):

    """Have Gemini compare photos for the most promising new pairs, once per pair."""

    pairs = [(report, item) for _, report, item in sorted(pairs, key=lambda p: p[0], reverse=True)

             if report.photos.exists() and item.photos.exists()

             and not MatchScore.objects.filter(report=report, item=item).exists()][:limit]

    if not pairs:

        return

    inputs = [(ai_photos(report.photos.all()), ai_photos(item.photos.all())) for report, item in pairs]

    with ThreadPoolExecutor(max_workers=limit) as pool:

        results = list(pool.map(lambda photos: ai.compare_photos(*photos), inputs))

    for (report, item), score in zip(pairs, results):

        if score is not None:

            MatchScore.objects.get_or_create(report=report, item=item, defaults={'photo_score': score})





DONATE_AFTER = timedelta(days=30)





def donate_unclaimed():

    """Open items nobody claimed within 30 days go to donation instead of waiting in matches forever."""

    stale = (FoundItem.objects.filter(status='open', found_at__lt=timezone.now() - DONATE_AFTER)
             .exclude(claims__status='pending'))

    for item in stale:

        if FoundItem.objects.filter(pk=item.pk, status='open').update(status='donated'):

            Notification.objects.create(user=item.finder, message=f'Found item #{item.id} went unclaimed for 30 days and is marked for donation.')





def notify_matches(report):

    for match in matches_for(report):

        if match['confidence'] != 'Strong match':

            continue

        message = f'A strong match may exist for lost report #{report.id}: found item #{match["item"]["id"]}.'

        if not Notification.objects.filter(user=report.owner, message=message).exists():

            Notification.objects.create(user=report.owner, message=message)





def user_json(user):
    return {'id': user.id, 'name': user.name, 'email': user.email, 'phone': user.phone}


@ensure_csrf_cookie
def session(request):
    if request.method == 'GET':
        user = user_for(request)
        return JsonResponse({
            'user': user_json(user) if user else None,
            'ai_enabled': bool(os.environ.get('GEMINI_API_KEY')),
            'sites': [site_json(s) for s in SITES],
            'default_site': DEFAULT_SITE,
        })
    if request.method == 'DELETE':
        request.session.flush()
        return JsonResponse({'user': None})
    return error('Method not allowed.', 405)


def signup(request):
    if request.method != 'POST':
        return error('Method not allowed.', 405)

    data = payload(request)
    print(data)
    name = str(data.get('name', '')).strip()
    password = str(data.get('password', ''))
    confirm = str(data.get('confirm_password', ''))
    email = str(data.get('email', '')).strip().lower()
    phone = str(data.get('phone', '')).strip()

    if not 6 <= len(name) <= 80:
        return error('Username must be between 6 and 80 characters.')
    if len(password) < 8:
        return error('Password must be at least 8 characters long.')
    if password != confirm:
        return error('Passwords do not match.')
    
    # This is only commented out for testing purposes
    # if not re.fullmatch(r'[^@\s]+@stonybrook\.edu', email):
    #    return error('Email must be a valid Stony Brook email address.')
    
    if len(email) > 254 or len(phone) > 30:
        return error('Email or phone number is too long.')
    if DemoUser.objects.filter(name=name).exists():
        return error('Username already exists.', 409)

    # For testing purposes, we allow duplicate emails. In production, this should be unique.
    # if DemoUser.objects.filter(email__iexact=email).exists():
    #    return error('Email already registered.', 409)

    user = DemoUser.objects.create(
        name=name,
        email=email,
        phone=phone,
        password_hash=make_password(password),
        email_verified=False,
    )

    token = signing.dumps(
        {
            "user_id": user.id,
            "email": user.email,
            "password_hash": user.password_hash,
        },
        salt="claimcheck-email-verification",
    )

    verification_url = request.build_absolute_uri(
        reverse("verify_email") + "?token=" + token
    )

    try:
        send_mail(
            subject="Verify your ClaimCheck email",
            message=(
                f"Welcome to ClaimCheck!\n\n"
                f"Verify your email by clicking this link:\n\n"
                f"{verification_url}\n\n"
                f"This link expires in 24 hours."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        user.delete()
        print(e)
        return error(
            "Could not send verification email. Please try again.",
            503,
        )

    return JsonResponse(
        {
            "message": "Check your email to verify your account.",
            "verification_required": True,
        },
        status=201,
    )

def verify_email(request):
    if request.method != "GET":
        return error("Method not allowed.", 405)

    token = request.GET.get("token", "")

    try:
        data = signing.loads(
            token,
            salt="claimcheck-email-verification",
            max_age=60 * 60 * 24,
        )
    except signing.BadSignature:
        return JsonResponse(
            {"error": "Invalid or expired verification link."},
            status=400,
        )

    user = DemoUser.objects.filter(
        id=data["user_id"],
        email=data["email"],
        password_hash=data["password_hash"],
    ).first()

    if user is None:
        return JsonResponse(
            {"error": "Invalid verification link."},
            status=400,
        )

    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])

    return HttpResponseRedirect(
        "http://localhost:5173/?verified=1"
    )

def login_user(request):
    if request.method != 'POST':
        return error('Method not allowed.', 405)

    data = payload(request)
    name = str(data.get('name', '')).strip()
    password = str(data.get('password', ''))
    user = DemoUser.objects.filter(name=name).first()
    if not user or not check_password(password, user.password_hash):
        return error('Invalid username or password.', 401)

    if not user.email_verified:
        return error(
            "Please verify your email before logging in.",
            403,
        )

    request.session.cycle_key()
    request.session['demo_user_id'] = user.id
    return JsonResponse({'user': user_json(user)})


def profile(request):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'PATCH':

        return error('Method not allowed.', 405)

    user.phone = str(payload(request).get('phone', '')).strip()[:30]

    user.save(update_fields=['phone'])

    return JsonResponse({'id': user.id, 'name': user.name, 'email': user.email, 'phone': user.phone})





def claim_json(claim, viewer):

    finder = claim.item.finder_id == viewer.id

    data = {'id': claim.id, 'item_id': claim.item_id, 'report_id': claim.report_id,

            'status': claim.status, 'answer': claim.answer, 'attempts': claim.attempts,

            'item': item_json(claim.item, viewer)}

    if claim.proof:

        data['proof_url'] = f'/api/claims/{claim.id}/proof/'

    if finder:

        data['claimant'] = {'name': claim.claimant.name}

        alt = ClaimQuestion.objects.filter(item=claim.item, claimant=claim.claimant, created_at__lte=claim.created_at).first()

        if alt:

            data['alt_question'] = {'question': alt.question, 'secret_detail': alt.secret_detail}

    if claim.status == 'approved':

        person = claim.claimant if finder else claim.item.finder

        data['contact'] = {'name': person.name, 'email': person.email, 'phone': person.phone}

    return data





def dashboard(request):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'GET':

        return error('Method not allowed.', 405)

    donate_unclaimed()

    claims = Claim.objects.filter(claimant=user, hidden_by_claimant=False) | Claim.objects.filter(item__finder=user, hidden_by_finder=False)

    return JsonResponse({

        'lost': [lost_json(r) for r in user.lost_reports.filter(hidden=False).order_by('-created_at').prefetch_related('photos')],

        'found': [item_json(i, user) for i in user.found_items.filter(hidden=False).order_by('-created_at').prefetch_related('photos')],

        'claims': [claim_json(c, user) for c in claims.distinct().order_by('-created_at')],

        'notifications': [{'id': n.id, 'message': n.message, 'read': n.read} for n in user.notifications.filter(hidden=False).order_by('-created_at')[:30]],

    })





def impact_counts(**item_filter):

    items = FoundItem.objects.filter(**item_filter)

    return {'returned': items.filter(status='returned').count(),
            'donated': items.filter(status='donated').count(),
            # Claims that failed the ownership check or that the finder turned down.
            'blocked': Claim.objects.filter(status='rejected', item__in=items).count()}


def impact(request):

    if not user_for(request):

        return error('Please log in first.', 401)

    if request.method != 'GET':

        return error('Method not allowed.', 405)

    donate_unclaimed()

    return JsonResponse({'network': impact_counts(), 'sites': {s: impact_counts(site=s) for s in SITES}})





def lost(request):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'POST':

        return error('Method not allowed.', 405)

    try:

        site = site_for(request.POST)

        lat, lng = coordinates(request.POST, site)

        description = request.POST.get('description', '').strip()[:2000]

        category = request.POST.get('category', 'Other')

        after, before = timestamp(request.POST.get('lost_after')), timestamp(request.POST.get('lost_before'))

        radius = int(request.POST.get('radius_m', 400))

        files = request.FILES.getlist('photos')

        validate_photos(files)

        files = normalized_photos(files)

        if not description or category not in CATEGORIES or not 50 <= radius <= 2000 or after > before:

            raise ValueError('Check the description, category, area, and time window.')

    except (ValueError, TypeError) as exc:

        return error(str(exc))

    report = LostReport.objects.create(owner=user, site=site, description=description, category=category,

                                       latitude=lat, longitude=lng, radius_m=radius,

                                       lost_after=after, lost_before=before,

                                       embedding=ai.embed(ai.describe_lost(description, files)))

    for file in files:

        ItemPhoto.objects.create(lost_report=report, image=file)

    score_photos(candidate_pairs([report], FoundItem.objects.filter(status='open', site=site)))

    notify_matches(report)

    return JsonResponse(lost_json(report), status=201)





def found(request):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'POST':

        return error('Method not allowed.', 405)

    try:

        site = site_for(request.POST)

        lat, lng = coordinates(request.POST, site)

        category = request.POST.get('category', 'Other')

        found_at = timestamp(request.POST.get('found_at'))

        files = request.FILES.getlist('photos')

        validate_photos(files, required=True)

        files = normalized_photos(files)

        secret = request.POST.get('secret_detail', '').strip()[:500]

        holding = request.POST.get('holding_location', '').strip()[:200]

        if category not in CATEGORIES or not secret or not holding:

            raise ValueError('Add a category, private detail, and current holding location.')

    except (ValueError, TypeError) as exc:

        return error(str(exc))

    description = request.POST.get('description', '').strip()[:2000]

    review = ai.review_found(description, category, secret, files)

    item = FoundItem.objects.create(finder=user, site=site, description=description,

                                    public_description=review['public_description'],

                                    secret_detail=review['secret_detail'], claim_question=review['claim_question'],

                                    category=category, latitude=lat, longitude=lng, found_at=found_at,

                                    location_note=request.POST.get('location_note', '').strip()[:200],

                                    holding_location=holding, ai_review=review['review'],

                                    embedding=ai.embed(f'{category} {description} {review["public_description"]}'))

    for index, file in enumerate(files):

        ItemPhoto.objects.create(found_item=item, image=file, public=index in review['public_photo_indexes'])

    reports = list(LostReport.objects.filter(status='open', site=site).exclude(owner=user))

    score_photos(candidate_pairs(reports, [item]))

    for report in reports:

        notify_matches(report)

    return JsonResponse(item_json(item, user), status=201)


def clear_reports(request):
    # Open posts are deleted. Returned and donated ones are only hidden, since claim history and impact counts point to them.
    # Handoffs in progress stay, because someone is still waiting on them.
    user = user_for(request)
    if not user:
        return error('Please log in first.', 401)
    if request.method != 'POST':
        return error('Method not allowed.', 405)
    deleted = user.lost_reports.filter(status='open').delete()[1].get('api.LostReport', 0)
    deleted += user.found_items.filter(status='open').delete()[1].get('api.FoundItem', 0)
    hidden = user.lost_reports.filter(status='returned', hidden=False).update(hidden=True)
    hidden += user.found_items.filter(status__in=('returned', 'donated'), hidden=False).update(hidden=True)
    kept = user.lost_reports.filter(hidden=False).count() + user.found_items.filter(hidden=False).count()
    return JsonResponse({'deleted': deleted, 'hidden': hidden, 'kept': kept})


def clear_claims(request):
    # Only hides finished claims from this user's list; the other person still sees them.
    # Claims awaiting a decision and handoffs not yet returned stay, since someone still has to act.
    user = user_for(request)
    if not user:
        return error('Please log in first.', 401)
    if request.method != 'POST':
        return error('Method not allowed.', 405)
    finished = Q(status='rejected') | Q(status='approved', item__status='returned')
    hidden = Claim.objects.filter(finished, claimant=user, hidden_by_claimant=False).update(hidden_by_claimant=True)
    hidden += Claim.objects.filter(finished, item__finder=user, hidden_by_finder=False).update(hidden_by_finder=True)
    kept = (Claim.objects.filter(claimant=user, hidden_by_claimant=False) | Claim.objects.filter(item__finder=user, hidden_by_finder=False)).distinct().count()
    return JsonResponse({'hidden': hidden, 'kept': kept})


def clear_notifications(request):
    user = user_for(request)
    if not user:
        return error('Please log in first.', 401)
    if request.method != 'POST':
        return error('Method not allowed.', 405)
    user.notifications.filter(hidden=False).update(hidden=True, read=True)
    return JsonResponse({'ok': True})


def new_claim_question(request, item_id):
    # After one wrong answer, a claimant can swap to a different question once. Attempts still cap at two.
    user = user_for(request)
    if not user:
        return error('Please log in first.', 401)
    if request.method != 'POST':
        return error('Method not allowed.', 405)
    item = get_object_or_404(FoundItem, pk=item_id, status='open')
    if item.finder_id == user.id:
        return error('You cannot claim your own item.', 403)
    if Claim.objects.filter(item=item, claimant=user, status='rejected').count() != 1:
        return error('A new question is only available after one wrong answer.', 409)
    if ClaimQuestion.objects.filter(item=item, claimant=user).exists():
        return error('You already have a new question for this item.', 409)
    result = ai.new_question(item.description, item.secret_detail, item.public_description, ai_photos(item.photos.all()))
    if not result:
        return error('Could not make a different question right now. Try the current one.', 503)
    try:
        alt = ClaimQuestion.objects.create(item=item, claimant=user, question=result['claim_question'],
                                           secret_detail=result['secret_detail'])
    except IntegrityError:
        return error('You already have a new question for this item.', 409)
    return JsonResponse({'claim_question': alt.question}, status=201)


def found_draft(request):
    # Snap-to-post: Gemini drafts the form from photos. Nothing is saved here.
    return draft_from_photos(request, ai.draft_found)


def lost_draft(request):
    return draft_from_photos(request, ai.draft_lost)


def draft_from_photos(request, drafter):
    user = user_for(request)
    if not user:
        return error('Please log in first.', 401)
    if request.method != 'POST':
        return error('Method not allowed.', 405)
    try:
        files = request.FILES.getlist('photos')
        validate_photos(files, required=True)
    except ValueError as exc:
        return error(str(exc))
    draft = drafter(normalized_photos(files), CATEGORIES)
    if not draft:
        return error('Could not draft from these photos. Fill in the details below.', 503)
    return JsonResponse(draft)





def lost_detail(request, report_id):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    report = get_object_or_404(LostReport, pk=report_id, owner=user)

    if request.method == 'GET':

        return JsonResponse({'report': lost_json(report), 'matches': matches_for(report)})

    if request.method == 'DELETE' and report.status == 'open':

        report.delete()

        return JsonResponse({'deleted': True})

    return error('This report cannot be changed.', 409)





def found_detail(request, item_id):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    item = get_object_or_404(FoundItem, pk=item_id)

    if request.method == 'GET':

        own = item.finder_id == user.id

        approved = Claim.objects.filter(item=item, claimant=user, status='approved').exists()

        matched = item.status == 'open' and any(

            m['item']['id'] == item.id

            for report in user.lost_reports.filter(status='open')

            for m in matches_for(report)

        )

        if not (own or approved or matched):

            return error('Item unavailable.', 404)

        return JsonResponse(item_json(item, user))

    if request.method == 'DELETE' and item.finder_id == user.id and item.status == 'open':

        item.delete()

        return JsonResponse({'deleted': True})

    return error('This item cannot be changed.', 409)





def photo(request, photo_id):

    if request.method != 'GET':

        return error('Method not allowed.', 405)

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    p = get_object_or_404(ItemPhoto, pk=photo_id)

    allowed = ((p.found_item_id and (p.found_item.finder_id == user.id or

                (p.public and p.found_item.status == 'open') or

                Claim.objects.filter(item=p.found_item, claimant=user, status='approved').exists())) or

               (p.lost_report_id and p.lost_report.owner_id == user.id))

    if not allowed:

        return error('Photo unavailable.', 404)

    return FileResponse(p.image.open('rb'), content_type='image/jpeg')





def claim_item(request, item_id):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'POST':

        return error('Method not allowed.', 405)

    item = get_object_or_404(FoundItem, pk=item_id, status='open')

    if item.finder_id == user.id:

        return error('You cannot claim your own item.', 403)

    if Claim.objects.filter(item=item, claimant=user, status='pending').exists():

        return error('Your claim is awaiting the finder’s decision.', 409)

    data = request.POST if request.content_type.startswith('multipart/form-data') else payload(request)

    answer = str(data.get('answer', '')).strip()[:1000]

    report = LostReport.objects.filter(pk=data.get('report_id'), owner=user, status='open').first()

    if not answer or not report:

        return error('Choose an open lost report and answer the question.')

    if item.id not in [match['item']['id'] for match in matches_for(report)]:

        return error('This item is not a match for the selected report.', 403)

    attempts = Claim.objects.filter(item=item, claimant=user, status='rejected').count()

    manual = str(data.get('manual', '')).lower() in ('true', '1')

    if attempts >= 2 and not manual:

        return error('Use a manual request after two failed answers.', 429)

    if manual and (attempts < 2 or Claim.objects.filter(item=item, claimant=user, status='pending').exists()):

        return error('Manual request is not available.', 409)

    proof_files = request.FILES.getlist('proof')

    try:

        validate_photos(proof_files)

        if len(proof_files) > 1:

            raise ValueError('Attach one proof photo.')

        if proof_files and not manual:

            raise ValueError('Proof photos are for manual requests.')

        proof = normalized_photos(proof_files)[0] if proof_files else None

    except ValueError as exc:

        return error(str(exc))

    alt = ClaimQuestion.objects.filter(item=item, claimant=user).first()
    verdict = 'unsure' if manual else ai.verify(alt.secret_detail if alt else item.secret_detail, answer)

    status = {'pass': 'approved', 'fail': 'rejected', 'unsure': 'pending'}[verdict]

    with transaction.atomic():
        # Conditional update so two simultaneous passing claims can't both win the item.
        if status == 'approved' and not FoundItem.objects.filter(pk=item.id, status='open').update(status='handoff'):
            return error('This item was just claimed by someone else.', 409)
        claim = Claim.objects.create(item=item, claimant=user, report=report, answer=answer,
                                     proof=proof, status=status, attempts=attempts + 1)
        if status == 'approved':
            item.status = 'handoff'
            LostReport.objects.filter(pk=report.id).update(status='handoff')
            Notification.objects.create(user=item.finder, message=f'A claim passed for found item #{item.id}. Arrange a handoff.')
        elif status == 'pending':
            Notification.objects.create(user=item.finder, message=f'A claim needs your decision for found item #{item.id}.')

    return JsonResponse(claim_json(claim, user), status=201)





def claim_decision(request, claim_id):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'POST':

        return error('Method not allowed.', 405)

    claim = get_object_or_404(Claim, pk=claim_id, item__finder=user, item__status='open', status='pending')

    approved = payload(request).get('approve') is True

    claim.status = 'approved' if approved else 'rejected'

    with transaction.atomic():
        if not Claim.objects.filter(pk=claim.id, status='pending').update(status=claim.status):
            return error('This claim was already decided.', 409)
        if approved:
            if not FoundItem.objects.filter(pk=claim.item_id, status='open').update(status='handoff'):
                transaction.set_rollback(True)
                return error('This item is no longer open.', 409)
            claim.item.status = 'handoff'
            if claim.report_id:  # the owner may have deleted their lost report
                LostReport.objects.filter(pk=claim.report_id).update(status='handoff')
        Notification.objects.create(user=claim.claimant, message=f'Your claim for item #{claim.item_id} was {claim.status}.')

    return JsonResponse(claim_json(claim, user))





def return_item(request, item_id):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    item = get_object_or_404(FoundItem, pk=item_id, status='handoff')

    claim = get_object_or_404(Claim, item=item, status='approved')

    if request.method != 'POST' or user.id not in (item.finder_id, claim.claimant_id):

        return error('Only the handoff participants can close it.', 403)

    item.status = 'returned'

    item.save(update_fields=['status'])

    if claim.report:

        claim.report.status = 'returned'

        claim.report.save(update_fields=['status'])

    other = claim.claimant if user.id == item.finder_id else item.finder

    Notification.objects.create(user=other, message=f'Item #{item.id} was marked as returned.')

    return JsonResponse(item_json(item, user))





def mark_read(request):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    if request.method != 'POST':

        return error('Method not allowed.', 405)

    user.notifications.filter(read=False).update(read=True)

    return JsonResponse({'ok': True})





def claim_proof(request, claim_id):

    user = user_for(request)

    if not user:

        return error('Please log in first.', 401)

    claim = get_object_or_404(Claim, pk=claim_id)

    if request.method != 'GET' or user.id not in (claim.claimant_id, claim.item.finder_id) or not claim.proof:

        return error('Proof unavailable.', 404)

    return FileResponse(claim.proof.open('rb'), content_type='image/jpeg')
