"""
training_data package — curriculum-ordered training examples.

Import order follows the best training order:
  1. JSON formatting discipline
  2. Single operations (cut, mute, music)
  3. Absolute timestamp reasoning
  4. Relative timeline understanding  ← MOST IMPORTANT
  5. Multi-step edits
  6. Conversation layer
  7. Error handling
  8. Context-aware edits
"""

from training_data.c01_json_formatting  import examples as c01
from training_data.c02_single_cut       import examples as c02
from training_data.c03_single_mute      import examples as c03
from training_data.c04_single_music     import examples as c04
from training_data.c05_absolute_time    import examples as c05
from training_data.c06_relative_time    import examples as c06
from training_data.c07_multi_step       import examples as c07
from training_data.c08_conversation     import examples as c08
from training_data.c09_error_handling   import examples as c09
from training_data.c10_context_aware    import examples as c10
from training_data.c11_schema_strictness import examples as c11
from training_data.c12_operation_whitelist import examples as c12
from training_data.c13_natural_chat     import examples as c13
from training_data.c14_rejections       import examples as c14

ALL_EXAMPLES = (
    c01 + c02 + c03 + c04 +
    c05 + c06 + c07 +
    c08 + c09 + c10 +
    c11 + c12 + c13 + c14
)

CATEGORY_COUNTS = {
    "c01_json_formatting":  len(c01),
    "c02_single_cut":       len(c02),
    "c03_single_mute":      len(c03),
    "c04_single_music":     len(c04),
    "c05_absolute_time":    len(c05),
    "c06_relative_time":    len(c06),
    "c07_multi_step":       len(c07),
    "c08_conversation":     len(c08),
    "c09_error_handling":   len(c09),
    "c10_context_aware":    len(c10),
    "c11_schema_strictness": len(c11),
    "c12_operation_whitelist": len(c12),
    "c13_natural_chat":     len(c13),
    "c14_rejections":       len(c14),
}
