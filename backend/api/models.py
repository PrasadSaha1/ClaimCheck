from django.db import models


class DemoUser(models.Model):
    name = models.CharField(max_length=80, unique=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    password_hash = models.CharField(max_length=128)


class LostReport(models.Model):
    owner = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='lost_reports')
    description = models.TextField()
    category = models.CharField(max_length=40)
    latitude = models.FloatField()
    longitude = models.FloatField()
    radius_m = models.PositiveIntegerField(default=400)
    lost_after = models.DateTimeField()
    lost_before = models.DateTimeField()
    embedding = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, default='open')
    created_at = models.DateTimeField(auto_now_add=True)


class FoundItem(models.Model):
    finder = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='found_items')
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
    created_at = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    user = models.ForeignKey(DemoUser, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=250)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
