from django.contrib import admin

from .models import Claim, DemoUser, FoundItem, ItemPhoto, LostReport, Notification


class PhotoInline(admin.TabularInline):
    model = ItemPhoto
    extra = 0
    fields = ('image', 'public')


@admin.register(DemoUser)
class DemoUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'phone')
    search_fields = ('name', 'email')


@admin.register(LostReport)
class LostReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner', 'category', 'description', 'status', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('description', 'owner__name')
    exclude = ('embedding',)
    inlines = [PhotoInline]


@admin.register(FoundItem)
class FoundItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'finder', 'category', 'public_description', 'status', 'ai_review', 'created_at')
    list_filter = ('status', 'category', 'ai_review')
    search_fields = ('description', 'public_description', 'finder__name')
    exclude = ('embedding',)
    inlines = [PhotoInline]


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ('id', 'item', 'claimant', 'status', 'attempts', 'created_at')
    list_filter = ('status',)
    search_fields = ('answer', 'claimant__name')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'message', 'read', 'created_at')
    list_filter = ('read',)
