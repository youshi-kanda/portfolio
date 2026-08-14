from rest_framework import serializers

_CONTENT_TYPE_CHOICES = [
    "line", "instagram", "google_business", "email", "sms", "pop", "flyer",
]

_INDUSTRY_CHOICES = [
    "esthetic", "bodycare", "gym", "hair", "nail", "other",
]


class ExpressionCheckRequestSerializer(serializers.Serializer):
    content_type = serializers.ChoiceField(choices=_CONTENT_TYPE_CHOICES)
    body         = serializers.CharField(min_length=1, max_length=2000)
    industry     = serializers.ChoiceField(choices=_INDUSTRY_CHOICES)
