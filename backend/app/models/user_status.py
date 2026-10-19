from enum import Enum


class UserStatus(str, Enum):
    """
    Account lifecycle state, separate from the user's role.

    Deactivating an account must never mean deleting the row: a user owns
    projects, reports and uploaded blueprints that stay part of the audit trail
    after they lose access. ``SUSPENDED`` revokes sign-in while leaving that
    history intact and the decision reversible.

    An ``INVITED`` state belongs with the emailed-invitation flow, where an
    account exists before its owner has set a password. Until that exists every
    account is created with a password, so adding the value now would only
    produce a state nothing can reach.
    """

    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"

    @property
    def can_sign_in(self) -> bool:
        """Only an active account may exchange credentials for a token."""
        return self is UserStatus.ACTIVE
