"""One-time VAPID keypair generator for Web Push.

Run: python3 scripts/gen_vapid_keys.py
Paste the printed VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY lines into .env, plus a
VAPID_CLAIM_EMAIL (a contact address push services may use to reach you about
this key). Re-running this script invalidates every existing browser
subscription (they're bound to the public key that was active when they
subscribed), so don't regenerate on a whim once real subscribers exist.
"""
import base64

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid01


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def main():
    v = Vapid01()
    v.generate_keys()

    private_raw = v.private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = v.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )

    print(f"VAPID_PUBLIC_KEY={b64url(public_raw)}")
    print(f"VAPID_PRIVATE_KEY={b64url(private_raw)}")
    print("VAPID_CLAIM_EMAIL=you@example.com")


if __name__ == "__main__":
    main()
