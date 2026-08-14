from rest_framework import serializers

from apps.stores.serializers import StoreBasicSerializer

from .models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "status"]
        read_only_fields = fields


class MeResponseSerializer(serializers.Serializer):
    user = UserSerializer(read_only=True)
    stores = StoreBasicSerializer(many=True, read_only=True)


class TokenRefreshBodySerializer(serializers.Serializer):
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True, allow_null=True)
