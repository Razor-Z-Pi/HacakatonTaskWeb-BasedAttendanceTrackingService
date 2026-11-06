from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class BearerTokenAuthentication(TokenAuthentication):
    """DRF token auth with the conventional Bearer prefix.

    Invalid or stale tokens are treated as anonymous requests. Public read
    endpoints therefore keep working after a token was revoked, while
    protected endpoints still return 401 through IsAuthenticated.
    """

    keyword = "Bearer"

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None
