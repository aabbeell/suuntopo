/* ABOUTME: Extra overrides for the "watch-fit" 32-bit size estimate (applied on top of lowmem.h, struct-size probe only).
 * ABOUTME: 16-bit heap pointers and 4-byte alignment give the 12-byte fixed-buffer header that watch JSalloc sizes imply. */
#define DUK_USE_HEAPPTR16
/* sizeof-only probe: the encode/decode macros are never executed. */
#define DUK_USE_HEAPPTR_ENC16(ud, p) ((duk_uint16_t) 0)
#define DUK_USE_HEAPPTR_DEC16(ud, x) ((void *) 0)
#undef DUK_USE_ALIGN_BY
#define DUK_USE_ALIGN_BY 4
