import asyncio
import sys
from app.services.satellite import SatelliteService

async def test():
    try:
        s = SatelliteService()
        token = await s.get_access_token()
        if token:
            print("SENTINEL_AUTH_SUCCESS")
        else:
            print("SENTINEL_AUTH_FAILED: Token is None")
    except Exception as e:
        print(f"SENTINEL_AUTH_FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test())
