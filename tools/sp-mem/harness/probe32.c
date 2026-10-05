// ABOUTME: Struct-size probe for Duktape internals: build.sh cross-compiles it to 32-bit ARM assembly (-S) with a variant's duk_config.h.
// ABOUTME: Each t32_* constant becomes a ".long N" in the assembly; build.sh turns them into target_sizes.h for the heap walk.

#include "duktape.c"

#if defined(DUK_USE_HOBJECT_LAYOUT_1)
#define PROBE_LAYOUT 1
#elif defined(DUK_USE_HOBJECT_LAYOUT_2)
#define PROBE_LAYOUT 2
#else
#define PROBE_LAYOUT 3
#endif

#if defined(DUK_USE_PACKED_TVAL)
#define PROBE_PACKED 1
#else
#define PROBE_PACKED 0
#endif

#if defined(DUK_USE_BUFFEROBJECT_SUPPORT)
#define PROBE_HBUFOBJ sizeof(duk_hbufobj)
#else
#define PROBE_HBUFOBJ 0
#endif

#if defined(DUK_USE_ES6_PROXY)
#define PROBE_HPROXY sizeof(duk_hproxy)
#else
#define PROBE_HPROXY 0
#endif

#define PROBE(name, expr) const unsigned int t32_##name = (unsigned int) (expr);

PROBE(ptr, sizeof(void *))
PROBE(tval, sizeof(duk_tval))
PROBE(packed_tval, PROBE_PACKED)
PROBE(propvalue, sizeof(duk_propvalue))
PROBE(align_by, DUK_USE_ALIGN_BY)
PROBE(layout, PROBE_LAYOUT)
PROBE(instr, sizeof(duk_instr_t))
PROBE(hstring, sizeof(duk_hstring))
PROBE(hobject, sizeof(duk_hobject))
PROBE(harray, sizeof(duk_harray))
PROBE(hcompfunc, sizeof(duk_hcompfunc))
PROBE(hnatfunc, sizeof(duk_hnatfunc))
PROBE(hboundfunc, sizeof(duk_hboundfunc))
PROBE(hbufobj, PROBE_HBUFOBJ)
PROBE(hthread, sizeof(duk_hthread))
PROBE(hdecenv, sizeof(duk_hdecenv))
PROBE(hobjenv, sizeof(duk_hobjenv))
PROBE(hproxy, PROBE_HPROXY)
PROBE(hbuffer_fixed, sizeof(duk_hbuffer_fixed))
PROBE(hbuffer_dynamic, sizeof(duk_hbuffer_dynamic))
PROBE(hbuffer_external, sizeof(duk_hbuffer_external))
PROBE(activation, sizeof(duk_activation))
PROBE(catcher, sizeof(duk_catcher))
PROBE(heap, sizeof(duk_heap))
PROBE(strtab_entry, sizeof(duk_hstring *))
/* Cross-checks of the property-table formula (layout padding included). */
PROBE(props_e1, DUK_HOBJECT_P_COMPUTE_SIZE(1, 0, 0))
PROBE(props_e3, DUK_HOBJECT_P_COMPUTE_SIZE(3, 0, 0))
PROBE(props_a1, DUK_HOBJECT_P_COMPUTE_SIZE(0, 1, 0))
PROBE(props_h1, DUK_HOBJECT_P_COMPUTE_SIZE(0, 0, 1))
PROBE(props_mix, DUK_HOBJECT_P_COMPUTE_SIZE(5, 7, 16))
