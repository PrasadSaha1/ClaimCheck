
from django.contrib import admin
from .models import (
    DemoUser,
    LostReport,
    FoundItem,
    Claim,
    ItemPhoto,
    Notification,
)

@admin.register(DemoUser)
class DemoUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'phone')
    search_fields = ('name', 'email')
    exclude = ('password_hash',)


@admin.register(LostReport)
class LostReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner', 'category', 'status', 'created_at')
    list_filter = ('category', 'status')


@admin.register(FoundItem)
class FoundItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'finder', 'category', 'status', 'found_at')
    list_filter = ('category', 'status')


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ('id', 'item', 'claimant', 'status')
    list_filter = ('status',)


admin.site.register(ItemPhoto)
admin.site.register(Notification)
