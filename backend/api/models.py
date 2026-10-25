from django.db import models


class DemoUser(models.Model):
    name = models.CharField(max_length=80, unique=True)
    email = models.EmailField(unique=False) # CHANGE TO TRUE LATER (and clear the db when you do to avoid errors)
    phone = models.CharField(max_length=30, blank=True)
    password_hash = models.CharField(max_length=128)
    email_verified = models.BooleanField(default=False)


class LostReport(models.Model):
    owner = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='lost_reports')
    site = models.CharField(max_length=40, default='stony-brook')  # A key in sites.SITES.
    description = models.TextField()
    category = models.CharField(max_length=40)
    latitude = models.FloatField()
    longitude = models.FloatField()
    radius_m = models.PositiveIntegerField(default=400)
    lost_after = models.DateTimeField()
    lost_before = models.DateTimeField()
    embedding = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, default='open')
    hidden = models.BooleanField(default=False)  # Cleared from the owner's dashboard.
    created_at = models.DateTimeField(auto_now_add=True)


class FoundItem(models.Model):
    finder = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='found_items')
    site = models.CharField(max_length=40, default='stony-brook')  # A key in sites.SITES.
    description = models.TextField(blank=True)
    public_description = models.TextField()
    secret_detail = models.TextField()
    claim_question = models.TextField()
    category = models.CharField(max_length=40)
    latitude = models.FloatField()
    longitude = models.FloatField()
    found_at = models.DateTimeField()
    location_note = models.CharField(max_length=200, blank=True)
    holding_location = models.CharField(max_length=200)
    embedding = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, default='open')
    hidden = models.BooleanField(default=False)  # Cleared from the owner's dashboard.
    ai_review = models.CharField(max_length=40, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)


class ItemPhoto(models.Model):
    found_item = models.ForeignKey(FoundItem, on_delete=models.CASCADE, related_name='photos', null=True, blank=True)
    lost_report = models.ForeignKey(LostReport, on_delete=models.CASCADE, related_name='photos', null=True, blank=True)
    image = models.ImageField(upload_to='items/%Y/%m/')
    public = models.BooleanField(default=False)


class Claim(models.Model):
    item = models.ForeignKey(FoundItem, on_delete=models.CASCADE, related_name='claims')
    claimant = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='claims')
    report = models.ForeignKey(LostReport, on_delete=models.SET_NULL, null=True, blank=True)
    answer = models.TextField()
    proof = models.ImageField(upload_to='proof/%Y/%m/', blank=True)
    status = models.CharField(max_length=20, default='pending')
    attempts = models.PositiveSmallIntegerField(default=1)
    # Each side can clear a finished claim from their own list without affecting the other person's.
    hidden_by_claimant = models.BooleanField(default=False)
    hidden_by_finder = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class MatchScore(models.Model):
    # Gemini's photo comparison for one lost/found pair, saved so it runs once per pair.
    report = models.ForeignKey(LostReport, on_delete=models.CASCADE, related_name='match_scores')
    item = models.ForeignKey(FoundItem, on_delete=models.CASCADE, related_name='match_scores')
    photo_score = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['report', 'item'], name='one_score_per_pair')]


class ClaimQuestion(models.Model):
    # A replacement question one claimant asked for after a wrong answer. Others keep the item's question.
    item = models.ForeignKey(FoundItem, on_delete=models.CASCADE, related_name='alt_questions')
    claimant = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='alt_questions')
    question = models.TextField()
    secret_detail = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['item', 'claimant'], name='one_alt_question_per_claimant')]


class Notification(models.Model):
    user = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=250)
    read = models.BooleanField(default=False)
    # Cleared from the inbox but kept, so the same match alert is not sent again.
    hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
