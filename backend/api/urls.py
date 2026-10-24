from django.urls import path
from . import views

urlpatterns = [
    path('session/', views.session),
    path('signup/', views.signup, name='signup'),
    path('login/', views.login_user, name='login'),
    path('verify-email/', views.verify_email, name='verify_email'),
    path('profile/', views.profile),
    path('dashboard/', views.dashboard),
    path('reports/clear/', views.clear_reports),
    path('claims/clear/', views.clear_claims),
    path('lost/', views.lost),
    path('lost/draft/', views.lost_draft),
    path('lost/<int:report_id>/', views.lost_detail),
    path('found/', views.found),
    path('found/draft/', views.found_draft),
    path('found/<int:item_id>/', views.found_detail),
    path('found/<int:item_id>/claims/', views.claim_item),
    path('found/<int:item_id>/question/', views.new_claim_question),
    path('found/<int:item_id>/return/', views.return_item),
    path('claims/<int:claim_id>/decision/', views.claim_decision),
    path('claims/<int:claim_id>/proof/', views.claim_proof),
    path('photos/<int:photo_id>/', views.photo),
    path('notifications/read/', views.mark_read),
    path('notifications/clear/', views.clear_notifications),
]
