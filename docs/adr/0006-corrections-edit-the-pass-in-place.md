# Corrections edit the pass in place

This replaces ADR 0004. The log was append-only because kiosk mode ran on the
teacher's live session, so anyone at the door could reach whatever the teacher
could. The kiosk is now a separate device that only hands passes over and never
holds the teacher's history, so that reason is gone. A correction now changes
the pass directly and marks it as corrected; the earlier reading is not kept.
A trail would add the cost of folding corrections over every read and buy no
extra trust, since the whole record already lives in one teacher's browser.
