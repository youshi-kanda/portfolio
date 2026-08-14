import re


def mask_name(name: str | None) -> str | None:
    """氏名マスキング: 先頭2文字を残し、残りを○に置換。"""
    if not name:
        return name
    chars = list(name)
    if len(chars) <= 2:
        return chars[0] + "○" * (len(chars) - 1)
    return "".join(chars[:2]) + "○" * (len(chars) - 2)


def mask_phone(phone: str | None) -> str | None:
    """電話番号マスキング: 中間4桁を****に置換。"""
    if not phone:
        return phone
    return re.sub(r"(\d{3}[-\s]?)\d{4}([-\s]?\d{4})", r"\1****\2", phone)


def mask_email(email: str | None) -> str | None:
    """メールアドレスマスキング: ローカルパートを1文字+***に置換。"""
    if not email:
        return email
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if not local:
        return f"***@{domain}"
    return f"{local[0]}***@{domain}"


def mask_line_display_name(name: str | None) -> str | None:
    """LINE表示名マスキング: 先頭1文字を残し、残りを○に置換。"""
    if not name:
        return name
    chars = list(name)
    return chars[0] + "○" * (len(chars) - 1)
