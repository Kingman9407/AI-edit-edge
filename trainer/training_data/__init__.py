"""
training_data package — curriculum-ordered training examples.

Import order follows the best training order:
  1. JSON formatting discipline
  2. Single operations (cut, mute, music)
  3. Time reasoning (absolute MM:SS + relative language)  ← MOST IMPORTANT
  4. Multi-step edits
  5. Natural chat & conversation handling
  6. Rejections (impossible + unsupported operations)
  7. Context-aware edits
  8. Schema strictness
  9. Operation whitelist
"""

from training_data.c01_json_formatting    import examples as c01
from training_data.c02_single_cut         import examples as c02
from training_data.c03_single_mute        import examples as c03
from training_data.c04_single_music       import examples as c04
from training_data.c05_time_reasoning     import examples as c05   # merged: absolute + relative
from training_data.c07_multi_step         import examples as c07
from training_data.c08_natural_chat       import examples as c08   # merged: conversation + Hornet
from training_data.c09_rejections         import examples as c09   # merged: error handling + rejections
from training_data.c10_context_aware      import examples as c10
from training_data.c11_schema_strictness  import examples as c11
from training_data.c12_operation_whitelist import examples as c12
from training_data.c13_chat_history import examples as c13

ALL_EXAMPLES = (
    c01 + c02 + c03 + c04 +
    c05 +
    c07 +
    c08 + c09 + c10 +
    c11 + c12 + c13
)

CATEGORY_COUNTS = {
    "c01_json_formatting":    len(c01),
    "c02_single_cut":         len(c02),
    "c03_single_mute":        len(c03),
    "c04_single_music":       len(c04),
    "c05_time_reasoning":     len(c05),
    "c07_multi_step":         len(c07),
    "c08_natural_chat":       len(c08),
    "c09_rejections":         len(c09),
    "c10_context_aware":      len(c10),
    "c11_schema_strictness":  len(c11),
    "c12_operation_whitelist": len(c12),
    "c13_chat_history":        len(c13),
}
