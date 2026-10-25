import io
import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.utils import timezone
from PIL import Image

from .models import DemoUser, FoundItem


def image():
    output = io.BytesIO()
    Image.new('RGB', (20, 20), 'red').save(output, 'JPEG')
    return SimpleUploadedFile('item.jpg', output.getvalue(), content_type='image/jpeg')


def account(name):
    DemoUser.objects.create(name=name, email=name + '@example.com', email_verified=True,
                            password_hash=make_password('password123'))
    client = Client()
    response = client.post('/api/login/', data=json.dumps({'name': name, 'password': 'password123'}),
                           content_type='application/json')
    assert response.status_code == 200
    return client


class ReportFlowTests(TestCase):
    def setUp(self):
        self.finder = account('Finder')
        self.owner = account('Owner')
        self.now = timezone.now()

    def found(self):
        return self.finder.post('/api/found/', {
            'photos': image(), 'description': 'black water bottle with a yellow sticker',
            'secret_detail': 'dent underneath', 'category': 'Other',
            'latitude': '40.9126', 'longitude': '-73.1232',
            'found_at': self.now.isoformat(), 'holding_location': 'Library desk',
        })

    def lost(self):
        return self.owner.post('/api/lost/', {
            'description': 'black water bottle with a yellow sticker', 'category': 'Other',
            'latitude': '40.9127', 'longitude': '-73.1233', 'radius_m': '400',
            'lost_after': (self.now - timedelta(hours=2)).isoformat(),
            'lost_before': (self.now + timedelta(hours=2)).isoformat(),
        })

    def test_report_match_private_photo_and_manual_handoff(self):
        found = self.found()
        self.assertEqual(found.status_code, 201, found.content)
        item = found.json()
        self.assertEqual(item['ai_review'], 'basic')
        photo_id = item['photos'][0]['id']
        lost = self.lost()
        self.assertEqual(lost.status_code, 201, lost.content)
        report_id = lost.json()['id']
        match = self.owner.get(f'/api/lost/{report_id}/').json()['matches']
        self.assertEqual(match[0]['item']['id'], item['id'])
        self.assertNotIn('secret_detail', match[0]['item'])
        self.assertNotIn('holding_location', match[0]['item'])
        self.assertEqual(match[0]['item']['photos'], [])
        self.assertEqual(self.owner.get(f'/api/photos/{photo_id}/').status_code, 404)
        self.assertEqual(self.finder.get(f'/api/photos/{photo_id}/').status_code, 200)
        self.assertEqual(self.owner.delete(f'/api/found/{item["id"]}/').status_code, 409)

        claim = self.owner.post(f'/api/found/{item["id"]}/claims/',
                                data=json.dumps({'report_id': report_id, 'answer': 'It has a dent on the underside'}),
                                content_type='application/json')
        self.assertEqual(claim.status_code, 201)
        self.assertEqual(claim.json()['status'], 'pending')
        self.assertNotIn('contact', claim.json())
        decision = self.finder.post(f'/api/claims/{claim.json()["id"]}/decision/',
                                    data=json.dumps({'approve': True}), content_type='application/json')
        self.assertEqual(decision.json()['status'], 'approved')
        self.assertEqual(FoundItem.objects.get(pk=item['id']).status, 'handoff')
        self.assertEqual(self.owner.get(f'/api/photos/{photo_id}/').status_code, 200)
        self.assertEqual(self.owner.post(f'/api/found/{item["id"]}/return/').status_code, 200)
        self.assertEqual(FoundItem.objects.get(pk=item['id']).status, 'returned')

    @patch('api.ai.similarity', return_value=.9)
    def test_different_categories_never_match(self, _similarity):
        self.finder.post('/api/found/', {
            'photos': image(), 'description': 'light blue rolled-up t-shirt with a graphic design',
            'secret_detail': 'paper band', 'category': 'Clothing',
            'latitude': '40.9126', 'longitude': '-73.1232',
            'found_at': self.now.isoformat(), 'holding_location': 'Library desk',
        })
        report_id = self.owner.post('/api/lost/', {
            'description': 'grey Lenovo laptop', 'category': 'Electronics',
            'latitude': '40.9127', 'longitude': '-73.1233', 'radius_m': '400',
            'lost_after': (self.now - timedelta(hours=2)).isoformat(),
            'lost_before': (self.now + timedelta(hours=2)).isoformat(),
        }).json()['id']
        self.assertEqual(self.owner.get(f'/api/lost/{report_id}/').json()['matches'], [])

    def test_items_at_another_place_never_match(self):
        self.finder.post('/api/found/', {
            'photos': image(), 'description': 'black water bottle with a yellow sticker',
            'secret_detail': 'dent underneath', 'category': 'Other', 'site': 'jfk',
            'latitude': '40.6413', 'longitude': '-73.7781',
            'found_at': self.now.isoformat(), 'holding_location': 'Terminal 4 information desk',
        })
        report_id = self.lost().json()['id']
        self.assertEqual(self.owner.get(f'/api/lost/{report_id}/').json()['matches'], [])
        outside = self.finder.post('/api/found/', {
            'photos': image(), 'description': 'umbrella', 'secret_detail': 'taped handle',
            'category': 'Other', 'site': 'jfk', 'latitude': '40.9126', 'longitude': '-73.1232',
            'found_at': self.now.isoformat(), 'holding_location': 'With me',
        })
        self.assertEqual(outside.status_code, 400)

    def test_unclaimed_item_is_donated_after_30_days(self):
        old = self.finder.post('/api/found/', {
            'photos': image(), 'description': 'grey scarf', 'secret_detail': 'name tag inside',
            'category': 'Clothing', 'latitude': '40.9126', 'longitude': '-73.1232',
            'found_at': (self.now - timedelta(days=31)).isoformat(), 'holding_location': 'Library desk',
        }).json()
        recent_id = self.found().json()['id']
        self.finder.get('/api/dashboard/')
        self.assertEqual(FoundItem.objects.get(pk=old['id']).status, 'donated')
        self.assertEqual(FoundItem.objects.get(pk=recent_id).status, 'open')
        counts = self.owner.get('/api/impact/').json()
        self.assertEqual(counts['sites']['stony-brook']['donated'], 1)
        self.assertEqual(counts['sites']['jfk']['donated'], 0)

    @patch('api.ai.verify', return_value='fail')
    def test_two_failed_answers_then_manual_request(self, _verify):
        item_id = self.found().json()['id']
        report_id = self.lost().json()['id']
        body = json.dumps({'report_id': report_id, 'answer': 'wrong'})
        for _ in range(2):
            response = self.owner.post(f'/api/found/{item_id}/claims/', data=body, content_type='application/json')
            self.assertEqual(response.json()['status'], 'rejected')
        self.assertEqual(self.owner.post(f'/api/found/{item_id}/claims/', data=body,
                                         content_type='application/json').status_code, 429)
        manual = self.owner.post(f'/api/found/{item_id}/claims/',
                                 {'report_id': report_id, 'answer': 'I have a receipt',
                                  'manual': 'true', 'proof': image()})
        self.assertEqual(manual.json()['status'], 'pending')
        proof_url = manual.json()['proof_url']
        self.assertEqual(self.finder.get(proof_url).status_code, 200)
        self.assertEqual(account('Stranger').get(proof_url).status_code, 404)
