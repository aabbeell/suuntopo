// ABOUTME: Duktape memory harness for SuuntoPlus apps: a byte-counting allocator, GC checkpoints and (internal builds) a heap walk with a 32-bit size model.
// ABOUTME: Runs the JS files given on the command line in one heap and exposes the native SPH object (memory, compile, storage, BLE recordings, canvas counters).

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdarg.h>

#if defined(SPMEM_INTERNAL)
/* Internal build: compile Duktape into this file so the heap walker can read engine structs. */
#include "duktape.c"
#include "target_sizes.h"
#define SPMEM_HAVE_WALK 1
#else
#include "duktape.h"
#define SPMEM_HAVE_WALK 0
#endif

#ifndef SPMEM_VARIANT
#define SPMEM_VARIANT "unknown"
#endif

/* ------------------------------------------------------------------------
 *  Counting allocator.  Every block carries a header with its requested
 *  size; the headers form a list so live blocks can be enumerated.
 *  Only requested bytes are counted, never the header or malloc slack.
 * ------------------------------------------------------------------------ */

#define SPM_MAGIC 0x53504d42u

typedef struct spm_block {
	struct spm_block *prev;
	struct spm_block *next;
	size_t size;
	uint64_t seq;    /* allocation serial, renewed when a realloc grows the block */
	uint32_t mark;
	uint32_t magic;
} spm_block;

static spm_block g_head = { &g_head, &g_head, 0, 0, 0, 0 };
static uint64_t g_seq = 0;       /* serial of the last alloc/growing realloc */
static uint64_t g_seq0 = 0;      /* serial at the "baseline" checkpoint: later blocks are app-allocated */
static size_t g_live = 0;
static size_t g_peak = 0;
static size_t g_blocks = 0;
static uint64_t g_allocs = 0;    /* alloc + growing realloc events */
static uint64_t g_frees = 0;
static uint64_t g_bytes = 0;     /* cumulative requested bytes (allocs + realloc growth) */
static uint64_t g_failed = 0;    /* allocations refused by --limit */
static size_t g_limit = 0;       /* 0 = no limit */
static size_t g_maxreq = 0;      /* largest single request (alloc size, or new size of a growing realloc) since the last reset */

/* Requests of at least SPM_BIGREQ_MIN host bytes are logged with the phase (checkpoint count) and tick they fell in,
 * so transient compile/parse blocks can be compared with the watch's "JSalloc:<n>" failure sizes. */
#define SPM_BIGREQ_MIN 1024
#define SPM_MAX_BIGREQ 8192
typedef struct {
	size_t size;
	size_t old;   /* previous size for a growing realloc, 0 for a fresh alloc */
	int phase;    /* number of checkpoints taken before this request */
	int t;        /* SP tick at the time (from tickBegin), or -99999 outside ticks */
} spm_bigreq;
static spm_bigreq g_bigreq[SPM_MAX_BIGREQ];
static int g_nbigreq = 0;
static unsigned long g_bigreq_dropped = 0;
static int g_cur_phase = 0;
static int g_cur_tick = -99999;

static void spm_note_req(size_t size, size_t old) {
	if (size > g_maxreq) {
		g_maxreq = size;
	}
	if (size >= SPM_BIGREQ_MIN) {
		if (g_nbigreq < SPM_MAX_BIGREQ) {
			spm_bigreq *r = &g_bigreq[g_nbigreq++];
			r->size = size;
			r->old = old;
			r->phase = g_cur_phase;
			r->t = g_cur_tick;
		} else {
			g_bigreq_dropped++;
		}
	}
}

static void spm_link(spm_block *b) {
	b->next = g_head.next;
	b->prev = &g_head;
	g_head.next->prev = b;
	g_head.next = b;
}

static void spm_unlink(spm_block *b) {
	b->prev->next = b->next;
	b->next->prev = b->prev;
}

static void spm_note_peak(void) {
	if (g_live > g_peak) {
		g_peak = g_live;
	}
}

static void *spm_alloc(void *udata, duk_size_t size) {
	spm_block *b;
	(void) udata;
	if (size == 0) {
		return NULL;
	}
	spm_note_req(size, 0);
	if (g_limit != 0 && g_live + size > g_limit) {
		g_failed++;
		return NULL;
	}
	b = (spm_block *) malloc(sizeof(spm_block) + size);
	if (b == NULL) {
		return NULL;
	}
	b->size = size;
	b->seq = ++g_seq;
	b->mark = 0;
	b->magic = SPM_MAGIC;
	spm_link(b);
	g_live += size;
	g_blocks++;
	g_allocs++;
	g_bytes += size;
	spm_note_peak();
	return (void *) (b + 1);
}

static void spm_free(void *udata, void *ptr) {
	spm_block *b;
	(void) udata;
	if (ptr == NULL) {
		return;
	}
	b = ((spm_block *) ptr) - 1;
	spm_unlink(b);
	g_live -= b->size;
	g_blocks--;
	g_frees++;
	b->magic = 0;
	free(b);
}

static void *spm_realloc(void *udata, void *ptr, duk_size_t size) {
	spm_block *b;
	spm_block *nb;
	size_t old;
	if (ptr == NULL) {
		return spm_alloc(udata, size);
	}
	if (size == 0) {
		spm_free(udata, ptr);
		return NULL;
	}
	b = ((spm_block *) ptr) - 1;
	old = b->size;
	if (size > old) {
		spm_note_req(size, old);
	}
	if (g_limit != 0 && size > old && g_live + (size - old) > g_limit) {
		g_failed++;
		return NULL;
	}
	spm_unlink(b);
	nb = (spm_block *) realloc(b, sizeof(spm_block) + size);
	if (nb == NULL) {
		spm_link(b);
		return NULL;
	}
	nb->size = size;
	if (size > old) {
		nb->seq = ++g_seq;
	}
	spm_link(nb);
	g_live = g_live - old + size;
	if (size > old) {
		g_allocs++;
		g_bytes += size - old;
	}
	spm_note_peak();
	return (void *) (nb + 1);
}

/* ------------------------------------------------------------------------
 *  Result records (kept in C memory so recording never touches the JS heap).
 * ------------------------------------------------------------------------ */

#define SPM_LABEL_MAX 96
#define SPM_MAX_CHECKPOINTS 256
#define SPM_MAX_TICKS 20000
#define SPM_MAX_FRAMES 20000
#define SPM_MAX_WARNINGS 64
#define SPM_MAX_ERRORS 64
#define SPM_TOP_RESIDUAL 8
#define SPM_TOP_APP 8

enum {
	CAT_STRINGS = 0,
	CAT_OBJECTS,
	CAT_SCOPES,
	CAT_FUNCTIONS,
	CAT_PROPTABLES,
	CAT_ARRAYPARTS,
	CAT_BUFFERS,
	CAT_ENGINE,
	CAT__COUNT
};

static const char *g_cat_names[CAT__COUNT] = {
	"strings", "objects", "scopes", "functions", "propTables", "arrayParts", "buffers", "engine"
};

typedef struct {
	double host[CAT__COUNT];
	double t32[CAT__COUNT];
	unsigned long count[CAT__COUNT];
	double host_total;
	double t32_total;
	double residual_bytes;
	unsigned long residual_blocks;
	size_t residual_top[SPM_TOP_RESIDUAL];
	unsigned long mismatches;
	unsigned long pending_objects; /* refzero/finalize list entries left after GC */
	double max_t32;          /* largest single live block, 32-bit estimate */
	size_t max_host;         /* its host size */
	int max_cat;             /* its category */
	double app_max_t32;      /* the same over blocks allocated (or grown) after the baseline checkpoint, engine blocks excluded */
	size_t app_max_host;
	int app_max_cat;
	double app_fn_max_t32;   /* largest app compiled-function block (functions category), however many larger app blocks exist */
	size_t app_fn_max_host;
	double app_top_t32[SPM_TOP_APP];  /* largest app blocks, descending (32-bit estimate) */
	size_t app_top_host[SPM_TOP_APP];
	int app_top_cat[SPM_TOP_APP];
	int valid;
} spm_walk_result;

typedef struct {
	char label[SPM_LABEL_MAX];
	size_t live;
	size_t phase_peak;
	size_t phase_maxreq;     /* largest single request during the phase that ends at this checkpoint */
	size_t blocks;
	uint64_t allocs;
	uint64_t bytes;
	spm_walk_result walk;
	spm_walk_result walk_alt; /* watch-fit layout (SPMEM_HAVE_ALT builds only) */
} spm_checkpoint;

typedef struct {
	int t;
	size_t live_pre;
	size_t live_post;
	size_t tick_peak;
	uint64_t allocs;
	uint64_t bytes;
	size_t max_req;
	long ms_garbage; /* bytes the tick-end mark-and-sweep freed beyond engine buffers (cyclic garbage refcounting missed); -1 = unknown */
} spm_tick;

enum {
	CV_BEGINPATH = 1, CV_CLOSEPATH, CV_MOVETO, CV_LINETO, CV_STROKE, CV_FILL, CV_FILLRECT,
	CV_FILLTEXT, CV_MEASURETEXT, CV_ARC, CV_ARCTO, CV_RECT, CV_STROKERECT, CV_CLEARRECT,
	CV_ROTATE, CV_TRANSLATE, CV_SCALE, CV_SETTRANSFORM, CV_SAVE, CV_RESTORE, CV_OTHER,
	CV__COUNT
};

static const char *g_cv_names[CV__COUNT] = {
	"", "beginPath", "closePath", "moveTo", "lineTo", "stroke", "fill", "fillRect",
	"fillText", "measureText", "arc", "arcTo", "rect", "strokeRect", "clearRect",
	"rotate", "translate", "scale", "setTransform", "save", "restore", "other"
};

typedef struct {
	int t;
	int canvas;
	unsigned long ops[CV__COUNT];
	unsigned long max_lineto_per_path;
	unsigned long cur_lineto;
} spm_frame;

static spm_checkpoint g_cps[SPM_MAX_CHECKPOINTS];
static int g_ncps = 0;
static spm_tick g_ticks[SPM_MAX_TICKS];
static int g_nticks = 0;
static spm_frame g_frames[SPM_MAX_FRAMES];
static int g_nframes = 0;
static spm_frame *g_cur_frame = NULL;
static char *g_warnings[SPM_MAX_WARNINGS];
static int g_nwarnings = 0;
static char *g_errors[SPM_MAX_ERRORS];
static int g_nerrors = 0;
static unsigned long g_errors_total = 0;
static char *g_fatal = NULL;

static size_t g_tick_live0 = 0;
static uint64_t g_tick_allocs0 = 0;
static uint64_t g_tick_bytes0 = 0;

static char *spm_strdup(const char *s) {
	size_t n = strlen(s);
	char *r = (char *) malloc(n + 1);
	if (r != NULL) {
		memcpy(r, s, n + 1);
	}
	return r;
}

/* ------------------------------------------------------------------------
 *  Heap walk (internal builds only).  Every engine allocation reachable from
 *  the heap is classified, its real host size is read from the allocator
 *  header, and a 32-bit size is computed from struct sizes measured by
 *  cross-compiling the same configuration for armv7k (see build.sh).
 * ------------------------------------------------------------------------ */

#if SPMEM_HAVE_WALK

typedef struct {
	size_t ptr, tval, propvalue, align_by, layout, instr;
	size_t hstring, hobject, harray, hcompfunc, hnatfunc, hboundfunc, hbufobj, hthread;
	size_t hdecenv, hobjenv, hproxy, hbuffer_fixed, hbuffer_dynamic, hbuffer_external;
	size_t activation, catcher, heap, strtab_entry;
} spm_layout;

#if !defined(DUK_USE_BUFFEROBJECT_SUPPORT)
#define SPM_SIZEOF_HBUFOBJ 0
#else
#define SPM_SIZEOF_HBUFOBJ sizeof(duk_hbufobj)
#endif
#if !defined(DUK_USE_ES6_PROXY)
#define SPM_SIZEOF_HPROXY 0
#else
#define SPM_SIZEOF_HPROXY sizeof(duk_hproxy)
#endif
#if defined(DUK_USE_HOBJECT_LAYOUT_1)
#define SPM_HOST_LAYOUT 1
#elif defined(DUK_USE_HOBJECT_LAYOUT_2)
#define SPM_HOST_LAYOUT 2
#else
#define SPM_HOST_LAYOUT 3
#endif

static const spm_layout g_host = {
	sizeof(void *), sizeof(duk_tval), sizeof(duk_propvalue), DUK_USE_ALIGN_BY, SPM_HOST_LAYOUT, sizeof(duk_instr_t),
	sizeof(duk_hstring), sizeof(duk_hobject), sizeof(duk_harray), sizeof(duk_hcompfunc), sizeof(duk_hnatfunc),
	sizeof(duk_hboundfunc), SPM_SIZEOF_HBUFOBJ, sizeof(duk_hthread),
	sizeof(duk_hdecenv), sizeof(duk_hobjenv), SPM_SIZEOF_HPROXY, sizeof(duk_hbuffer_fixed), sizeof(duk_hbuffer_dynamic),
	sizeof(duk_hbuffer_external), sizeof(duk_activation), sizeof(duk_catcher), sizeof(duk_heap), sizeof(duk_hstring *)
};

static const spm_layout g_t32 = {
	T32_PTR, T32_TVAL, T32_PROPVALUE, T32_ALIGN_BY, T32_LAYOUT, T32_INSTR,
	T32_HSTRING, T32_HOBJECT, T32_HARRAY, T32_HCOMPFUNC, T32_HNATFUNC,
	T32_HBOUNDFUNC, T32_HBUFOBJ, T32_HTHREAD,
	T32_HDECENV, T32_HOBJENV, T32_HPROXY, T32_HBUFFER_FIXED, T32_HBUFFER_DYNAMIC,
	T32_HBUFFER_EXTERNAL, T32_ACTIVATION, T32_CATCHER, T32_HEAP, T32_STRTAB_ENTRY
};

#if defined(SPMEM_HAVE_ALT)
/* Second 32-bit layout for the "watch-fit" estimate: the lowmem configuration plus DUK_USE_HEAPPTR16 and
 * DUK_USE_ALIGN_BY 4 (harness/config/watchfit.h), which gives the 12-byte fixed-buffer header that watch
 * JSalloc sizes imply (calibration/exp-fingerprint.js). With HEAPPTR16 the string table holds 16-bit entries. */
#include "target_sizes_alt.h"
static const spm_layout g_alt = {
	TA_PTR, TA_TVAL, TA_PROPVALUE, TA_ALIGN_BY, TA_LAYOUT, TA_INSTR,
	TA_HSTRING, TA_HOBJECT, TA_HARRAY, TA_HCOMPFUNC, TA_HNATFUNC,
	TA_HBOUNDFUNC, TA_HBUFOBJ, TA_HTHREAD,
	TA_HDECENV, TA_HOBJENV, TA_HPROXY, TA_HBUFFER_FIXED, TA_HBUFFER_DYNAMIC,
	TA_HBUFFER_EXTERNAL, TA_ACTIVATION, TA_CATCHER, TA_HEAP, 2
};
#endif

/* Layout the walk currently estimates with (g_t32, or g_alt during the second walk). */
static const spm_layout *g_tl = &g_t32;

/* Same formula as DUK_HOBJECT_P_COMPUTE_SIZE, parameterised by layout. */
static size_t spm_props_size(const spm_layout *L, size_t e, size_t a, size_t h) {
	size_t pad = 0;
	if (L->layout == 2) {
		if (L->align_by == 4) {
			pad = (4 - e) & 0x03;
		} else if (L->align_by == 8) {
			pad = (8 - e) & 0x07;
		}
	}
	return e * (L->ptr + L->propvalue + 1) + pad + a * L->tval + h * 4;
}

static uint32_t g_epoch = 1;
static spm_walk_result *g_wr = NULL;

/* Account one allocation.  Returns 1 if it was newly counted. */
static int spm_take(const void *ptr, int cat, size_t host_expected, double t32) {
	spm_block *b;
	if (ptr == NULL) {
		return 0;
	}
	b = ((spm_block *) ptr) - 1;
	if (b->magic != SPM_MAGIC) {
		return 0; /* not ours (should not happen without ROM objects) */
	}
	if (b->mark == g_epoch) {
		return 0;
	}
	b->mark = g_epoch;
	if (b->size != host_expected) {
		g_wr->mismatches++;
	}
	g_wr->host[cat] += (double) b->size;
	g_wr->t32[cat] += t32;
	g_wr->count[cat]++;
	if (t32 > g_wr->max_t32) {
		g_wr->max_t32 = t32;
		g_wr->max_host = b->size;
		g_wr->max_cat = cat;
	}
	/* Engine blocks (value stack, activations, string table, heap struct) are excluded: at a checkpoint their size is set by
	 * the harness driver's call depth, and the value stack is "new" after baseline only because it was reallocated. */
	if (g_seq0 != 0 && b->seq > g_seq0 && cat != CAT_ENGINE) {
		int k, j;
		if (cat == CAT_FUNCTIONS && t32 > g_wr->app_fn_max_t32) {
			g_wr->app_fn_max_t32 = t32;
			g_wr->app_fn_max_host = b->size;
		}
		if (t32 > g_wr->app_max_t32) {
			g_wr->app_max_t32 = t32;
			g_wr->app_max_host = b->size;
			g_wr->app_max_cat = cat;
		}
		for (k = 0; k < SPM_TOP_APP; k++) {
			if (t32 > g_wr->app_top_t32[k]) {
				for (j = SPM_TOP_APP - 1; j > k; j--) {
					g_wr->app_top_t32[j] = g_wr->app_top_t32[j - 1];
					g_wr->app_top_host[j] = g_wr->app_top_host[j - 1];
					g_wr->app_top_cat[j] = g_wr->app_top_cat[j - 1];
				}
				g_wr->app_top_t32[k] = t32;
				g_wr->app_top_host[k] = b->size;
				g_wr->app_top_cat[k] = cat;
				break;
			}
		}
	}
	return 1;
}

/* Account a property allocation, splitting the array part into its own category. */
static void spm_take_props(duk_heap *heap, duk_hobject *h, int cat) {
	duk_uint8_t *p = DUK_HOBJECT_GET_PROPS(heap, h);
	size_t e = (size_t) DUK_HOBJECT_GET_ESIZE(h);
	size_t a = (size_t) DUK_HOBJECT_GET_ASIZE(h);
	size_t hs = (size_t) DUK_HOBJECT_GET_HSIZE(h);
	size_t host_size = (size_t) DUK_HOBJECT_P_ALLOC_SIZE(h);
	size_t t32_size = spm_props_size(g_tl, e, a, hs);
	if (p == NULL) {
		return;
	}
	if (spm_props_size(&g_host, e, a, hs) != host_size) {
		g_wr->mismatches++;
	}
	if (spm_take(p, cat, host_size, (double) t32_size)) {
		double arr_host = (double) (a * g_host.tval);
		double arr_t32 = (double) (a * g_tl->tval);
		g_wr->host[cat] -= arr_host;
		g_wr->t32[cat] -= arr_t32;
		g_wr->host[CAT_ARRAYPARTS] += arr_host;
		g_wr->t32[CAT_ARRAYPARTS] += arr_t32;
		if (a > 0) {
			g_wr->count[CAT_ARRAYPARTS]++;
		}
	}
}

static void spm_take_thread(duk_heap *heap, duk_hthread *thr) {
	duk_activation *act;
	size_t n_tv = (size_t) (thr->valstack_alloc_end - thr->valstack);
	(void) heap;
	spm_take(thr->valstack, CAT_ENGINE, n_tv * sizeof(duk_tval), (double) (n_tv * g_tl->tval));
	for (act = thr->callstack_curr; act != NULL; act = act->parent) {
		duk_catcher *cat;
		spm_take(act, CAT_ENGINE, sizeof(duk_activation), (double) g_tl->activation);
		for (cat = act->cat; cat != NULL; cat = cat->parent) {
			spm_take(cat, CAT_ENGINE, sizeof(duk_catcher), (double) g_tl->catcher);
		}
	}
}

static void spm_walk_object(duk_heap *heap, duk_hobject *h) {
	int props_cat = CAT_PROPTABLES;
	if (DUK_HOBJECT_IS_COMPFUNC(h)) {
		duk_hcompfunc *f = (duk_hcompfunc *) h;
		duk_hbuffer_fixed *data = DUK_HCOMPFUNC_GET_DATA(heap, f);
		spm_take(h, CAT_FUNCTIONS, sizeof(duk_hcompfunc), (double) g_tl->hcompfunc);
		if (data != NULL) {
			size_t n_consts = (size_t) (DUK_HCOMPFUNC_GET_CONSTS_SIZE(heap, f) / sizeof(duk_tval));
			size_t n_funcs = (size_t) (DUK_HCOMPFUNC_GET_FUNCS_SIZE(heap, f) / sizeof(duk_hobject *));
			size_t code_bytes = (size_t) DUK_HCOMPFUNC_GET_CODE_SIZE(heap, f);
			size_t size = (size_t) DUK_HBUFFER_GET_SIZE((duk_hbuffer *) data);
			double t32 = (double) (g_tl->hbuffer_fixed + n_consts * g_tl->tval + n_funcs * g_tl->ptr +
			                       (code_bytes / sizeof(duk_instr_t)) * g_tl->instr);
			spm_take(data, CAT_FUNCTIONS, sizeof(duk_hbuffer_fixed) + size, t32);
		}
	} else if (DUK_HOBJECT_IS_NATFUNC(h)) {
		spm_take(h, CAT_FUNCTIONS, sizeof(duk_hnatfunc), (double) g_tl->hnatfunc);
	} else if (DUK_HOBJECT_IS_BOUNDFUNC(h)) {
		duk_hboundfunc *bf = (duk_hboundfunc *) h;
		spm_take(h, CAT_FUNCTIONS, sizeof(duk_hboundfunc), (double) g_tl->hboundfunc);
		spm_take(bf->args, CAT_FUNCTIONS, (size_t) bf->nargs * sizeof(duk_tval), (double) ((size_t) bf->nargs * g_tl->tval));
#if defined(DUK_USE_BUFFEROBJECT_SUPPORT)
	} else if (DUK_HOBJECT_IS_BUFOBJ(h)) {
		spm_take(h, CAT_BUFFERS, sizeof(duk_hbufobj), (double) g_tl->hbufobj);
#endif
	} else if (DUK_HOBJECT_IS_THREAD(h)) {
		spm_take(h, CAT_ENGINE, sizeof(duk_hthread), (double) g_tl->hthread);
		spm_take_thread(heap, (duk_hthread *) h);
		props_cat = CAT_ENGINE;
	} else if (DUK_HOBJECT_IS_ARRAY(h)) {
		spm_take(h, CAT_OBJECTS, sizeof(duk_harray), (double) g_tl->harray);
	} else if (DUK_HOBJECT_IS_DECENV(h)) {
		spm_take(h, CAT_SCOPES, sizeof(duk_hdecenv), (double) g_tl->hdecenv);
		props_cat = CAT_SCOPES;
	} else if (DUK_HOBJECT_IS_OBJENV(h)) {
		spm_take(h, CAT_SCOPES, sizeof(duk_hobjenv), (double) g_tl->hobjenv);
		props_cat = CAT_SCOPES;
#if defined(DUK_USE_ES6_PROXY)
	} else if (DUK_HOBJECT_IS_PROXY(h)) {
		spm_take(h, CAT_OBJECTS, sizeof(duk_hproxy), (double) g_tl->hproxy);
#endif
	} else {
		spm_take(h, CAT_OBJECTS, sizeof(duk_hobject), (double) g_tl->hobject);
	}
	spm_take_props(heap, h, props_cat);
}

static void spm_walk_buffer(duk_heap *heap, duk_hbuffer *b) {
	size_t size = (size_t) DUK_HBUFFER_GET_SIZE(b);
	(void) heap;
	if (DUK_HBUFFER_HAS_DYNAMIC(b)) {
		if (DUK_HBUFFER_HAS_EXTERNAL(b)) {
			spm_take(b, CAT_BUFFERS, sizeof(duk_hbuffer_external), (double) g_tl->hbuffer_external);
		} else {
			duk_hbuffer_dynamic *d = (duk_hbuffer_dynamic *) b;
			spm_take(b, CAT_BUFFERS, sizeof(duk_hbuffer_dynamic), (double) g_tl->hbuffer_dynamic);
			spm_take(DUK_HBUFFER_DYNAMIC_GET_DATA_PTR(heap, d), CAT_BUFFERS, size, (double) size);
		}
	} else {
		spm_take(b, CAT_BUFFERS, sizeof(duk_hbuffer_fixed) + size, (double) (g_tl->hbuffer_fixed + size));
	}
}

static void spm_walk_list(duk_heap *heap, duk_heaphdr *list, int pass, int count_pending) {
	duk_heaphdr *hdr;
	for (hdr = list; hdr != NULL; hdr = DUK_HEAPHDR_GET_NEXT(heap, hdr)) {
		if (count_pending && pass == 0) {
			g_wr->pending_objects++;
		}
		if (pass == 0 && DUK_HEAPHDR_GET_TYPE(hdr) == DUK_HTYPE_OBJECT) {
			spm_walk_object(heap, (duk_hobject *) hdr);
		} else if (pass == 1 && DUK_HEAPHDR_GET_TYPE(hdr) == DUK_HTYPE_BUFFER) {
			spm_walk_buffer(heap, (duk_hbuffer *) hdr);
		}
	}
}

static void spm_walk(duk_context *ctx, spm_walk_result *wr) {
	duk_hthread *thr = (duk_hthread *) ctx;
	duk_heap *heap = thr->heap;
	duk_uint32_t i;
	int pass;
	spm_block *b;
	int k;

	memset(wr, 0, sizeof(*wr));
	g_wr = wr;
	g_epoch++;

	spm_take(heap, CAT_ENGINE, sizeof(duk_heap), (double) g_tl->heap);
#if defined(DUK_USE_HEAPPTR16)
#error heap walk does not support DUK_USE_HEAPPTR16
#else
	spm_take(heap->strtable, CAT_ENGINE, (size_t) heap->st_size * sizeof(duk_hstring *), (double) ((size_t) heap->st_size * g_tl->strtab_entry));
	for (i = 0; i < heap->st_size; i++) {
		duk_hstring *h;
		for (h = heap->strtable[i]; h != NULL; h = h->hdr.h_next) {
			size_t blen = (size_t) DUK_HSTRING_GET_BYTELEN(h);
			spm_take(h, CAT_STRINGS, sizeof(duk_hstring) + blen + 1, (double) (g_tl->hstring + blen + 1));
		}
	}
#endif

	/* Pass 0: objects (claims function data buffers), pass 1: remaining buffers. */
	for (pass = 0; pass < 2; pass++) {
		spm_walk_list(heap, heap->heap_allocated, pass, 0);
#if defined(DUK_USE_FINALIZER_SUPPORT)
		spm_walk_list(heap, heap->finalize_list, pass, 1);
#endif
#if defined(DUK_USE_REFERENCE_COUNTING)
		spm_walk_list(heap, heap->refzero_list, pass, 1);
#endif
	}
#if defined(DUK_USE_CACHE_ACTIVATION)
	{
		duk_activation *act;
		for (act = heap->activation_free; act != NULL; act = act->parent) {
			spm_take(act, CAT_ENGINE, sizeof(duk_activation), (double) g_tl->activation);
		}
	}
#endif
#if defined(DUK_USE_CACHE_CATCHER)
	{
		duk_catcher *cat;
		for (cat = heap->catcher_free; cat != NULL; cat = cat->parent) {
			spm_take(cat, CAT_ENGINE, sizeof(duk_catcher), (double) g_tl->catcher);
		}
	}
#endif

	/* Anything not reached is residual; remember the largest blocks for diagnosis. */
	for (b = g_head.next; b != &g_head; b = b->next) {
		if (b->mark != g_epoch) {
			wr->residual_bytes += (double) b->size;
			wr->residual_blocks++;
			for (k = 0; k < SPM_TOP_RESIDUAL; k++) {
				if (b->size > wr->residual_top[k]) {
					memmove(&wr->residual_top[k + 1], &wr->residual_top[k], (SPM_TOP_RESIDUAL - k - 1) * sizeof(size_t));
					wr->residual_top[k] = b->size;
					break;
				}
			}
		}
	}
	for (k = 0; k < CAT__COUNT; k++) {
		wr->host_total += wr->host[k];
		wr->t32_total += wr->t32[k];
	}
	wr->valid = 1;
	g_wr = NULL;
}

/* Host bytes of the engine buffers a mark-and-sweep may release or shrink without any garbage being involved: the
 * value stack (shrunk to fit), the activation/catcher freelists (freed on every GC) and the string table. */
static size_t spm_engine_gc_bytes(duk_context *ctx) {
	duk_hthread *thr = (duk_hthread *) ctx;
	duk_heap *heap = thr->heap;
	size_t n = (size_t) ((duk_uint8_t *) thr->valstack_alloc_end - (duk_uint8_t *) thr->valstack);
#if defined(DUK_USE_CACHE_ACTIVATION)
	{
		duk_activation *act;
		for (act = heap->activation_free; act != NULL; act = act->parent) {
			n += sizeof(duk_activation);
		}
	}
#endif
#if defined(DUK_USE_CACHE_CATCHER)
	{
		duk_catcher *cat;
		for (cat = heap->catcher_free; cat != NULL; cat = cat->parent) {
			n += sizeof(duk_catcher);
		}
	}
#endif
	n += (size_t) heap->st_size * sizeof(duk_hstring *);
	return n;
}

#endif /* SPMEM_HAVE_WALK */

/* ------------------------------------------------------------------------
 *  localStorage backing store, held in C memory like the watch's data.jsn,
 *  so strings handed to the app are freshly allocated in the JS heap.
 * ------------------------------------------------------------------------ */

#define SPM_MAX_STORE 64

typedef struct {
	char *key;
	char *value;
	size_t len;
	int kind; /* 1 = string item, 2 = object (JSON text) */
} spm_store_entry;

static spm_store_entry g_store[SPM_MAX_STORE];
static int g_nstore = 0;

static spm_store_entry *spm_store_find(const char *key) {
	int i;
	for (i = 0; i < g_nstore; i++) {
		if (strcmp(g_store[i].key, key) == 0) {
			return &g_store[i];
		}
	}
	return NULL;
}

/* ------------------------------------------------------------------------
 *  Byte recordings for BLE notification feeds, held in C memory.
 * ------------------------------------------------------------------------ */

#define SPM_MAX_RECS 16

typedef struct {
	unsigned char *data;
	size_t len;
	size_t pos;
} spm_rec;

static spm_rec g_recs[SPM_MAX_RECS];
static int g_nrecs = 0;

static unsigned char *spm_read_file(const char *path, size_t *out_len) {
	FILE *f = fopen(path, "rb");
	unsigned char *buf;
	long n;
	if (f == NULL) {
		return NULL;
	}
	fseek(f, 0, SEEK_END);
	n = ftell(f);
	fseek(f, 0, SEEK_SET);
	buf = (unsigned char *) malloc((size_t) n + 1);
	if (buf == NULL) {
		fclose(f);
		return NULL;
	}
	if (n > 0 && fread(buf, 1, (size_t) n, f) != (size_t) n) {
		free(buf);
		fclose(f);
		return NULL;
	}
	buf[n] = 0;
	fclose(f);
	*out_len = (size_t) n;
	return buf;
}

static const char *spm_basename(const char *path) {
	const char *s = strrchr(path, '/');
	return s ? s + 1 : path;
}

/* ------------------------------------------------------------------------
 *  Native functions exposed as SPH.*
 * ------------------------------------------------------------------------ */

static void spm_gc(duk_context *ctx) {
	duk_gc(ctx, 0);
	duk_gc(ctx, 0);
}

/* SPH.load(path, kind): kind 0 = run as global program, 1 = compile as a
 * function body and return the function, 2 = evaluate as an expression
 * (evalFile semantics) and return its value.  Source stays in C memory. */
static duk_ret_t sph_load(duk_context *ctx) {
	const char *path = duk_require_string(ctx, 0);
	int kind = duk_require_int(ctx, 1);
	size_t len = 0;
	unsigned char *src = spm_read_file(path, &len);
	char *wrapped = NULL;
	const char *code;
	size_t code_len;
	duk_uint_t flags = 0;
	if (src == NULL) {
		return duk_error(ctx, DUK_ERR_ERROR, "cannot read %s", path);
	}
	if (kind == 1 || kind == 2) {
		const char *pre = (kind == 1) ? "function(){" : "function(){return (";
		const char *post = (kind == 1) ? "\n}" : "\n);}";
		size_t n = len;
		if (kind == 2) {
			while (n > 0 && (src[n - 1] == ';' || src[n - 1] == ' ' || src[n - 1] == '\n' || src[n - 1] == '\r' || src[n - 1] == '\t')) {
				n--;
			}
		}
		wrapped = (char *) malloc(strlen(pre) + n + strlen(post) + 1);
		memcpy(wrapped, pre, strlen(pre));
		memcpy(wrapped + strlen(pre), src, n);
		memcpy(wrapped + strlen(pre) + n, post, strlen(post) + 1);
		code = wrapped;
		code_len = strlen(pre) + n + strlen(post);
		flags = DUK_COMPILE_FUNCTION;
	} else {
		code = (const char *) src;
		code_len = len;
	}
	duk_push_string(ctx, spm_basename(path));
	if (duk_pcompile_lstring_filename(ctx, flags, code, code_len) != 0) {
		free(src);
		free(wrapped);
		return duk_throw(ctx);
	}
	free(src);
	free(wrapped);
	if (kind == 1) {
		return 1;
	}
	duk_call(ctx, 0);
	return (kind == 2) ? 1 : 0;
}

static duk_ret_t sph_gc(duk_context *ctx) {
	spm_gc(ctx);
	return 0;
}

static duk_ret_t sph_live(duk_context *ctx) {
	duk_push_number(ctx, (duk_double_t) g_live);
	return 1;
}

static duk_ret_t sph_peak(duk_context *ctx) {
	duk_push_number(ctx, (duk_double_t) g_peak);
	return 1;
}

static duk_ret_t sph_reset_peak(duk_context *ctx) {
	(void) ctx;
	g_peak = g_live;
	return 0;
}

/* SPH.checkpoint(label): full GC, record live/peak (and the heap walk), reset the phase peak. */
static duk_ret_t sph_checkpoint(duk_context *ctx) {
	char label[SPM_LABEL_MAX];
	spm_checkpoint *cp;
	size_t phase_peak = g_peak;
	size_t phase_maxreq = g_maxreq;
	snprintf(label, sizeof(label), "%s", duk_require_string(ctx, 0));
	duk_pop(ctx);
	spm_gc(ctx);
	if (g_ncps >= SPM_MAX_CHECKPOINTS) {
		return duk_error(ctx, DUK_ERR_RANGE_ERROR, "too many checkpoints");
	}
	cp = &g_cps[g_ncps++];
	memset(cp, 0, sizeof(*cp));
	snprintf(cp->label, sizeof(cp->label), "%s", label);
	if (g_seq0 == 0 && strcmp(label, "baseline") == 0) {
		g_seq0 = g_seq; /* blocks allocated from here on count as app blocks for the largest-app-block statistic */
	}
	cp->live = g_live;
	cp->phase_peak = phase_peak;
	cp->phase_maxreq = phase_maxreq;
	cp->blocks = g_blocks;
	cp->allocs = g_allocs;
	cp->bytes = g_bytes;
#if SPMEM_HAVE_WALK
	spm_walk(ctx, &cp->walk);
#if defined(SPMEM_HAVE_ALT)
	g_tl = &g_alt;
	spm_walk(ctx, &cp->walk_alt);
	g_tl = &g_t32;
#endif
#endif
	g_peak = g_live;
	g_maxreq = 0;
	g_cur_phase = g_ncps;
	duk_push_number(ctx, (duk_double_t) g_live);
	return 1;
}

/* SPH.maxReq(): largest single request since the last checkpoint, tickBegin or resetMaxReq. */
static duk_ret_t sph_max_req(duk_context *ctx) {
	duk_push_number(ctx, (duk_double_t) g_maxreq);
	return 1;
}

static duk_ret_t sph_reset_max_req(duk_context *ctx) {
	(void) ctx;
	g_maxreq = 0;
	return 0;
}

/* SPH.setLimit(bytes): refuse allocations that would push live bytes above this (0 = no limit). */
static duk_ret_t sph_set_limit(duk_context *ctx) {
	g_limit = (size_t) duk_require_number(ctx, 0);
	return 0;
}

static duk_ret_t sph_tick_begin(duk_context *ctx) {
	(void) ctx;
	g_tick_live0 = g_live;
	g_tick_allocs0 = g_allocs;
	g_tick_bytes0 = g_bytes;
	g_peak = g_live;
	g_maxreq = 0;
	g_cur_tick = duk_get_top(ctx) > 0 ? duk_get_int(ctx, 0) : g_cur_tick;
	return 0;
}

static duk_ret_t sph_tick_end(duk_context *ctx) {
	int t = duk_require_int(ctx, 0);
	spm_tick *tk;
	size_t tick_peak = g_peak;
	if (g_nticks >= SPM_MAX_TICKS) {
		spm_gc(ctx);
		return 0;
	}
	tk = &g_ticks[g_nticks++];
	tk->t = t;
	tk->live_pre = g_live;
	tk->tick_peak = tick_peak;
	tk->allocs = g_allocs - g_tick_allocs0;
	tk->bytes = g_bytes - g_tick_bytes0;
	tk->max_req = g_maxreq;
	g_cur_tick = -99999;
	tk->ms_garbage = -1;
#if SPMEM_HAVE_WALK
	{
		/* Refcounting frees acyclic garbage at once, so what this GC frees, minus engine buffer shrink, is cyclic garbage
		 * (e.g. closures and their scope records). Stock Duktape collects it only on a voluntary GC (after roughly
		 * 50 allocations per live object) or on allocation failure, so on the watch it can accumulate across ticks. */
		size_t eng_pre = spm_engine_gc_bytes(ctx);
		size_t eng_post;
		spm_gc(ctx);
		eng_post = spm_engine_gc_bytes(ctx);
		tk->ms_garbage = ((long) tk->live_pre - (long) g_live) - ((long) eng_pre - (long) eng_post);
	}
#else
	spm_gc(ctx);
#endif
	tk->live_post = g_live;
	(void) g_tick_live0;
	return 0;
}

/* SPH.lsKind(key) -> 0 missing, 1 string item, 2 object */
static duk_ret_t sph_ls_kind(duk_context *ctx) {
	spm_store_entry *e = spm_store_find(duk_require_string(ctx, 0));
	duk_push_int(ctx, e ? e->kind : 0);
	return 1;
}

/* SPH.lsGet(key) -> fresh string (item value or object JSON) or null */
static duk_ret_t sph_ls_get(duk_context *ctx) {
	spm_store_entry *e = spm_store_find(duk_require_string(ctx, 0));
	if (e == NULL) {
		duk_push_null(ctx);
	} else {
		duk_push_lstring(ctx, e->value, e->len);
	}
	return 1;
}

/* SPH.lsSet(key, string, kind) copies the value into C memory. */
static duk_ret_t sph_ls_set(duk_context *ctx) {
	const char *key = duk_require_string(ctx, 0);
	duk_size_t len = 0;
	const char *val = duk_require_lstring(ctx, 1, &len);
	int kind = duk_require_int(ctx, 2);
	spm_store_entry *e = spm_store_find(key);
	if (e == NULL) {
		if (g_nstore >= SPM_MAX_STORE) {
			return duk_error(ctx, DUK_ERR_RANGE_ERROR, "localStorage stub full");
		}
		e = &g_store[g_nstore++];
		e->key = spm_strdup(key);
		e->value = NULL;
	}
	free(e->value);
	e->value = (char *) malloc(len + 1);
	memcpy(e->value, val, len);
	e->value[len] = 0;
	e->len = (size_t) len;
	e->kind = kind;
	return 0;
}

static duk_ret_t sph_read_text(duk_context *ctx) {
	const char *path = duk_require_string(ctx, 0);
	size_t len = 0;
	unsigned char *buf = spm_read_file(path, &len);
	if (buf == NULL) {
		return duk_error(ctx, DUK_ERR_ERROR, "cannot read %s", path);
	}
	duk_push_lstring(ctx, (const char *) buf, len);
	free(buf);
	return 1;
}

static duk_ret_t sph_rec_open(duk_context *ctx) {
	const char *path = duk_require_string(ctx, 0);
	size_t len = 0;
	unsigned char *buf;
	if (g_nrecs >= SPM_MAX_RECS) {
		return duk_error(ctx, DUK_ERR_RANGE_ERROR, "too many recordings");
	}
	buf = spm_read_file(path, &len);
	if (buf == NULL) {
		return duk_error(ctx, DUK_ERR_ERROR, "cannot read %s", path);
	}
	g_recs[g_nrecs].data = buf;
	g_recs[g_nrecs].len = len;
	g_recs[g_nrecs].pos = 0;
	duk_push_int(ctx, g_nrecs++);
	return 1;
}

/* Push bytes as the configured JS type: 0 Array of numbers, 1 Uint8Array, 2 plain buffer. */
static void spm_push_bytes(duk_context *ctx, const unsigned char *p, size_t n, int type) {
	size_t i;
	if (type == 1 || type == 2) {
		unsigned char *dst = (unsigned char *) duk_push_fixed_buffer(ctx, n);
		if (n > 0) {
			memcpy(dst, p, n);
		}
		if (type == 1) {
			duk_push_buffer_object(ctx, -1, 0, n, DUK_BUFOBJ_UINT8ARRAY);
			duk_remove(ctx, -2);
		}
		return;
	}
#if SPMEM_HAVE_WALK
	/* One allocation of the final size, as a firmware building the array natively would do. */
	{
		duk_tval *tv = duk_push_harray_with_size_outptr((duk_hthread *) ctx, (duk_uint32_t) n);
		for (i = 0; i < n; i++) {
			DUK_TVAL_SET_NUMBER(tv + i, (duk_double_t) p[i]);
		}
	}
#else
	duk_push_array(ctx);
	for (i = 0; i < n; i++) {
		duk_push_uint(ctx, (duk_uint_t) p[i]);
		duk_put_prop_index(ctx, -2, (duk_uarridx_t) i);
	}
#endif
}

/* SPH.recNext(handle, maxLen, lineMode, type): next notification payload or undefined at end.
 * lineMode 1 = one text line per notification (newline included, truncated to maxLen). */
static duk_ret_t sph_rec_next(duk_context *ctx) {
	int h = duk_require_int(ctx, 0);
	size_t max_len = (size_t) duk_require_uint(ctx, 1);
	int line_mode = duk_require_int(ctx, 2);
	int type = duk_require_int(ctx, 3);
	spm_rec *r;
	size_t n;
	if (h < 0 || h >= g_nrecs) {
		return duk_error(ctx, DUK_ERR_RANGE_ERROR, "bad recording handle");
	}
	r = &g_recs[h];
	if (r->pos >= r->len) {
		return 0;
	}
	n = r->len - r->pos;
	if (line_mode) {
		size_t k;
		for (k = 0; k < n; k++) {
			if (r->data[r->pos + k] == '\n') {
				n = k + 1;
				break;
			}
		}
		spm_push_bytes(ctx, r->data + r->pos, n < max_len ? n : max_len, type);
		r->pos += n;
		return 1;
	}
	if (n > max_len) {
		n = max_len;
	}
	spm_push_bytes(ctx, r->data + r->pos, n, type);
	r->pos += n;
	return 1;
}

static duk_ret_t sph_rec_rewind(duk_context *ctx) {
	int h = duk_require_int(ctx, 0);
	if (h >= 0 && h < g_nrecs) {
		g_recs[h].pos = 0;
	}
	return 0;
}

/* SPH.bytes(arrayLike, type): copy an array of byte values into the configured JS type. */
static duk_ret_t sph_bytes(duk_context *ctx) {
	duk_size_t n, i;
	unsigned char tmp[512];
	int type = duk_require_int(ctx, 1);
	duk_get_prop_string(ctx, 0, "length");
	n = (duk_size_t) duk_to_uint(ctx, -1);
	duk_pop(ctx);
	if (n > sizeof(tmp)) {
		n = sizeof(tmp);
	}
	for (i = 0; i < n; i++) {
		duk_get_prop_index(ctx, 0, (duk_uarridx_t) i);
		tmp[i] = (unsigned char) (duk_to_uint(ctx, -1) & 0xff);
		duk_pop(ctx);
	}
	spm_push_bytes(ctx, tmp, (size_t) n, type);
	return 1;
}

static duk_ret_t sph_cv_begin(duk_context *ctx) {
	int canvas = duk_require_int(ctx, 0);
	int t = duk_require_int(ctx, 1);
	if (g_nframes >= SPM_MAX_FRAMES) {
		g_cur_frame = NULL;
		return 0;
	}
	g_cur_frame = &g_frames[g_nframes++];
	memset(g_cur_frame, 0, sizeof(*g_cur_frame));
	g_cur_frame->t = t;
	g_cur_frame->canvas = canvas;
	return 0;
}

static void spm_cv_count(int op) {
	spm_frame *f = g_cur_frame;
	if (f == NULL) {
		return;
	}
	if (op <= 0 || op >= CV__COUNT) {
		op = CV_OTHER;
	}
	f->ops[op]++;
	if (op == CV_BEGINPATH) {
		f->cur_lineto = 0;
	} else if (op == CV_LINETO) {
		f->cur_lineto++;
		if (f->cur_lineto > f->max_lineto_per_path) {
			f->max_lineto_per_path = f->cur_lineto;
		}
	}
}

static duk_ret_t sph_cv(duk_context *ctx) {
	spm_cv_count(duk_require_int(ctx, 0));
	return 0;
}

/* A native canvas method (the op code is the function's magic), so a draw call costs one native
 * call like on the watch.  measureText returns a fresh {width} object (12 px per character). */
static duk_ret_t sph_cv_op(duk_context *ctx) {
	int op = duk_get_current_magic(ctx);
	spm_cv_count(op);
	if (op == CV_MEASURETEXT) {
		duk_size_t n = duk_is_string(ctx, 0) ? duk_get_length(ctx, 0) : 0;
		duk_push_object(ctx);
		duk_push_number(ctx, (duk_double_t) n * 12.0);
		duk_put_prop_string(ctx, -2, "width");
		return 1;
	}
	return 0;
}

/* SPH.cvMethod(op) -> native function counting that canvas op. */
static duk_ret_t sph_cv_method(duk_context *ctx) {
	int op = duk_require_int(ctx, 0);
	duk_push_c_function(ctx, sph_cv_op, DUK_VARARGS);
	duk_set_magic(ctx, -1, op);
	return 1;
}

static duk_ret_t sph_cv_end(duk_context *ctx) {
	(void) ctx;
	g_cur_frame = NULL;
	return 0;
}

static duk_ret_t sph_print(duk_context *ctx) {
	fprintf(stderr, "%s\n", duk_safe_to_string(ctx, 0));
	return 0;
}

static duk_ret_t sph_warn(duk_context *ctx) {
	const char *msg = duk_safe_to_string(ctx, 0);
	int i;
	for (i = 0; i < g_nwarnings; i++) {
		if (strcmp(g_warnings[i], msg) == 0) {
			return 0;
		}
	}
	if (g_nwarnings < SPM_MAX_WARNINGS) {
		g_warnings[g_nwarnings++] = spm_strdup(msg);
	}
	fprintf(stderr, "warning: %s\n", msg);
	return 0;
}

/* SPH.error(msg): an app callback threw; recorded and the run continues like on the watch. */
static duk_ret_t sph_error(duk_context *ctx) {
	const char *msg = duk_safe_to_string(ctx, 0);
	g_errors_total++;
	if (g_nerrors < SPM_MAX_ERRORS) {
		int i;
		for (i = 0; i < g_nerrors; i++) {
			if (strcmp(g_errors[i], msg) == 0) {
				return 0;
			}
		}
		g_errors[g_nerrors++] = spm_strdup(msg);
		fprintf(stderr, "app error: %s\n", msg);
	}
	return 0;
}

static const duk_function_list_entry g_sph_funcs[] = {
	{ "load", sph_load, 2 },
	{ "gc", sph_gc, 0 },
	{ "live", sph_live, 0 },
	{ "peak", sph_peak, 0 },
	{ "resetPeak", sph_reset_peak, 0 },
	{ "maxReq", sph_max_req, 0 },
	{ "resetMaxReq", sph_reset_max_req, 0 },
	{ "checkpoint", sph_checkpoint, 1 },
	{ "setLimit", sph_set_limit, 1 },
	{ "tickBegin", sph_tick_begin, DUK_VARARGS },
	{ "tickEnd", sph_tick_end, 1 },
	{ "lsKind", sph_ls_kind, 1 },
	{ "lsGet", sph_ls_get, 1 },
	{ "lsSet", sph_ls_set, 3 },
	{ "readText", sph_read_text, 1 },
	{ "recOpen", sph_rec_open, 1 },
	{ "recNext", sph_rec_next, 4 },
	{ "recRewind", sph_rec_rewind, 1 },
	{ "bytes", sph_bytes, 2 },
	{ "cvBegin", sph_cv_begin, 2 },
	{ "cv", sph_cv, 1 },
	{ "cvMethod", sph_cv_method, 1 },
	{ "cvEnd", sph_cv_end, 0 },
	{ "print", sph_print, 1 },
	{ "warn", sph_warn, 1 },
	{ "error", sph_error, 1 },
	{ NULL, NULL, 0 }
};

/* ------------------------------------------------------------------------
 *  JSON report
 * ------------------------------------------------------------------------ */

static void spm_json_str(FILE *f, const char *s) {
	fputc('"', f);
	for (; *s; s++) {
		unsigned char c = (unsigned char) *s;
		if (c == '"' || c == '\\') {
			fputc('\\', f);
			fputc(c, f);
		} else if (c < 0x20) {
			fprintf(f, "\\u%04x", c);
		} else {
			fputc(c, f);
		}
	}
	fputc('"', f);
}

static void spm_write_report(const char *path) {
	FILE *f = path ? fopen(path, "w") : stdout;
	int i, k;
	if (f == NULL) {
		fprintf(stderr, "cannot write %s\n", path);
		return;
	}
	fprintf(f, "{\n\"variant\": ");
	spm_json_str(f, SPMEM_VARIANT);
	fprintf(f, ",\n\"hostPtrBytes\": %u,\n\"walk\": %s,\n", (unsigned) sizeof(void *), SPMEM_HAVE_WALK ? "true" : "false");
#if SPMEM_HAVE_WALK
	fprintf(f, "\"layout\": {\"host\": {\"ptr\": %u, \"tval\": %u, \"hstring\": %u, \"hobject\": %u, \"harray\": %u, \"hcompfunc\": %u, \"hdecenv\": %u, \"hbufobj\": %u, \"propvalue\": %u, \"alignBy\": %u, \"heap\": %u},\n",
	        (unsigned) g_host.ptr, (unsigned) g_host.tval, (unsigned) g_host.hstring, (unsigned) g_host.hobject, (unsigned) g_host.harray,
	        (unsigned) g_host.hcompfunc, (unsigned) g_host.hdecenv, (unsigned) g_host.hbufobj, (unsigned) g_host.propvalue,
	        (unsigned) g_host.align_by, (unsigned) g_host.heap);
	fprintf(f, "  \"target32\": {\"ptr\": %u, \"tval\": %u, \"hstring\": %u, \"hobject\": %u, \"harray\": %u, \"hcompfunc\": %u, \"hdecenv\": %u, \"hbufobj\": %u, \"propvalue\": %u, \"alignBy\": %u, \"heap\": %u}},\n",
	        (unsigned) g_t32.ptr, (unsigned) g_t32.tval, (unsigned) g_t32.hstring, (unsigned) g_t32.hobject, (unsigned) g_t32.harray,
	        (unsigned) g_t32.hcompfunc, (unsigned) g_t32.hdecenv, (unsigned) g_t32.hbufobj, (unsigned) g_t32.propvalue,
	        (unsigned) g_t32.align_by, (unsigned) g_t32.heap);
#endif
	fprintf(f, "\"limit\": %lu,\n\"failedAllocs\": %llu,\n", (unsigned long) g_limit, (unsigned long long) g_failed);
	fprintf(f, "\"categories\": [");
	for (k = 0; k < CAT__COUNT; k++) {
		fprintf(f, "%s", k ? ", " : "");
		spm_json_str(f, g_cat_names[k]);
	}
	fprintf(f, "],\n\"checkpoints\": [\n");
	for (i = 0; i < g_ncps; i++) {
		spm_checkpoint *cp = &g_cps[i];
		fprintf(f, "  {\"label\": ");
		spm_json_str(f, cp->label);
		fprintf(f, ", \"live\": %lu, \"phasePeak\": %lu, \"phaseMaxReq\": %lu, \"blocks\": %lu, \"allocs\": %llu, \"bytes\": %llu",
		        (unsigned long) cp->live, (unsigned long) cp->phase_peak, (unsigned long) cp->phase_maxreq, (unsigned long) cp->blocks,
		        (unsigned long long) cp->allocs, (unsigned long long) cp->bytes);
		if (cp->walk.valid) {
			spm_walk_result *w = &cp->walk;
			fprintf(f, ",\n   \"walk\": {\"hostTotal\": %.0f, \"t32Total\": %.0f, \"residualBytes\": %.0f, \"residualBlocks\": %lu, \"mismatches\": %lu, \"pending\": %lu, \"maxBlockT32\": %.0f, \"maxBlockHost\": %lu, \"maxBlockCat\": ",
			        w->host_total, w->t32_total, w->residual_bytes, w->residual_blocks, w->mismatches, w->pending_objects,
			        w->max_t32, (unsigned long) w->max_host);
			spm_json_str(f, g_cat_names[w->max_cat]);
			fprintf(f, ", \"maxAppBlockT32\": %.0f, \"maxAppBlockHost\": %lu, \"maxAppBlockCat\": ", w->app_max_t32, (unsigned long) w->app_max_host);
			spm_json_str(f, g_cat_names[w->app_max_cat]);
			fprintf(f, ", \"maxAppFnBlockT32\": %.0f, \"maxAppFnBlockHost\": %lu", w->app_fn_max_t32, (unsigned long) w->app_fn_max_host);
			fprintf(f, ", \"appTopBlocks\": [");
			for (k = 0; k < SPM_TOP_APP && w->app_top_t32[k] > 0; k++) {
				fprintf(f, "%s[%.0f, %lu, ", k ? ", " : "", w->app_top_t32[k], (unsigned long) w->app_top_host[k]);
				spm_json_str(f, g_cat_names[w->app_top_cat[k]]);
				fprintf(f, "]");
			}
			fprintf(f, "], \"residualTop\": [");
			for (k = 0; k < SPM_TOP_RESIDUAL && w->residual_top[k] > 0; k++) {
				fprintf(f, "%s%lu", k ? ", " : "", (unsigned long) w->residual_top[k]);
			}
			fprintf(f, "],\n    \"host\": [");
			for (k = 0; k < CAT__COUNT; k++) {
				fprintf(f, "%s%.0f", k ? ", " : "", w->host[k]);
			}
			fprintf(f, "], \"t32\": [");
			for (k = 0; k < CAT__COUNT; k++) {
				fprintf(f, "%s%.0f", k ? ", " : "", w->t32[k]);
			}
			fprintf(f, "], \"count\": [");
			for (k = 0; k < CAT__COUNT; k++) {
				fprintf(f, "%s%lu", k ? ", " : "", w->count[k]);
			}
			fprintf(f, "]}");
		}
		if (cp->walk_alt.valid) {
			spm_walk_result *w = &cp->walk_alt;
			fprintf(f, ",\n   \"walkAlt\": {\"name\": \"lowmem+HEAPPTR16+ALIGN_BY4\", \"t32Total\": %.0f, \"maxAppBlockT32\": %.0f, \"t32\": [",
			        w->t32_total, w->app_max_t32);
			for (k = 0; k < CAT__COUNT; k++) {
				fprintf(f, "%s%.0f", k ? ", " : "", w->t32[k]);
			}
			fprintf(f, "]}");
		}
		fprintf(f, "}%s\n", i + 1 < g_ncps ? "," : "");
	}
	fprintf(f, "],\n\"ticks\": [\n");
	for (i = 0; i < g_nticks; i++) {
		spm_tick *t = &g_ticks[i];
		fprintf(f, "  [%d, %lu, %lu, %lu, %llu, %llu, %lu, %ld]%s\n", t->t, (unsigned long) t->live_pre, (unsigned long) t->live_post,
		        (unsigned long) t->tick_peak, (unsigned long long) t->allocs, (unsigned long long) t->bytes, (unsigned long) t->max_req,
		        t->ms_garbage, i + 1 < g_nticks ? "," : "");
	}
	fprintf(f, "],\n\"tickFields\": [\"t\", \"livePreGc\", \"livePostGc\", \"tickPeak\", \"allocs\", \"bytes\", \"maxReq\", \"msGarbage\"],\n");
	fprintf(f, "\"bigRequestMin\": %d,\n\"bigRequestsDropped\": %lu,\n\"bigRequestFields\": [\"size\", \"oldSize\", \"phase\", \"t\"],\n\"bigRequests\": [",
	        SPM_BIGREQ_MIN, g_bigreq_dropped);
	for (i = 0; i < g_nbigreq; i++) {
		fprintf(f, "%s[%lu, %lu, %d, %d]", i ? ", " : "", (unsigned long) g_bigreq[i].size, (unsigned long) g_bigreq[i].old,
		        g_bigreq[i].phase, g_bigreq[i].t);
	}
	fprintf(f, "],\n");
	fprintf(f, "\"canvasOps\": [");
	for (k = 1; k < CV__COUNT; k++) {
		fprintf(f, "%s", k > 1 ? ", " : "");
		spm_json_str(f, g_cv_names[k]);
	}
	fprintf(f, "],\n\"frames\": [\n");
	for (i = 0; i < g_nframes; i++) {
		spm_frame *fr = &g_frames[i];
		fprintf(f, "  {\"t\": %d, \"canvas\": %d, \"maxLineToPerPath\": %lu, \"ops\": [", fr->t, fr->canvas, fr->max_lineto_per_path);
		for (k = 1; k < CV__COUNT; k++) {
			fprintf(f, "%s%lu", k > 1 ? ", " : "", fr->ops[k]);
		}
		fprintf(f, "]}%s\n", i + 1 < g_nframes ? "," : "");
	}
	fprintf(f, "],\n\"warnings\": [");
	for (i = 0; i < g_nwarnings; i++) {
		fprintf(f, "%s", i ? ", " : "");
		spm_json_str(f, g_warnings[i]);
	}
	fprintf(f, "],\n\"errorsTotal\": %lu,\n\"errors\": [", g_errors_total);
	for (i = 0; i < g_nerrors; i++) {
		fprintf(f, "%s", i ? ", " : "");
		spm_json_str(f, g_errors[i]);
	}
	fprintf(f, "],\n\"fatal\": ");
	if (g_fatal != NULL) {
		spm_json_str(f, g_fatal);
	} else {
		fprintf(f, "null");
	}
	fprintf(f, "\n}\n");
	if (path) {
		fclose(f);
	}
}

static void spm_fatal_handler(void *udata, const char *msg) {
	(void) udata;
	fprintf(stderr, "*** FATAL: %s\n", msg ? msg : "(null)");
	abort();
}

static duk_ret_t spm_run_file(duk_context *ctx, void *udata) {
	(void) udata;
	duk_push_global_object(ctx);
	duk_get_prop_string(ctx, -1, "SPH");
	duk_get_prop_string(ctx, -1, "load");
	duk_dup(ctx, 0); /* file path argument of the safe call */
	duk_push_int(ctx, 0);
	duk_call(ctx, 2);
	return 0;
}

static void spm_usage(void) {
	fprintf(stderr,
	        "usage: sp-mem [--out report.json] [--limit BYTES] file.js [file.js ...]\n"
	        "Runs the files in order as global code in one Duktape heap. The last file is\n"
	        "normally the driver; it uses the native SPH object to take checkpoints.\n");
}

int main(int argc, char *argv[]) {
	duk_context *ctx;
	const char *out = NULL;
	int i;
	int first_file = -1;
	int rc = 0;

	for (i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--out") == 0 && i + 1 < argc) {
			out = argv[++i];
		} else if (strcmp(argv[i], "--limit") == 0 && i + 1 < argc) {
			g_limit = (size_t) strtoul(argv[++i], NULL, 10);
		} else if (strcmp(argv[i], "--help") == 0) {
			spm_usage();
			return 0;
		} else {
			first_file = i;
			break;
		}
	}
	if (first_file < 0) {
		spm_usage();
		return 2;
	}

	ctx = duk_create_heap(spm_alloc, spm_realloc, spm_free, NULL, spm_fatal_handler);
	if (ctx == NULL) {
		fprintf(stderr, "cannot create heap\n");
		return 1;
	}
	duk_push_global_object(ctx);
	duk_push_object(ctx);
	duk_put_function_list(ctx, -1, g_sph_funcs);
	duk_push_string(ctx, SPMEM_VARIANT);
	duk_put_prop_string(ctx, -2, "variant");
	duk_push_boolean(ctx, SPMEM_HAVE_WALK);
	duk_put_prop_string(ctx, -2, "hasWalk");
	duk_put_prop_string(ctx, -2, "SPH");
	duk_pop(ctx);

#if SPMEM_HAVE_WALK
	/* The 32-bit property-table formula must reproduce the probe's own DUK_HOBJECT_P_COMPUTE_SIZE values. */
	if (spm_props_size(&g_t32, 1, 0, 0) != T32_PROPS_E1 || spm_props_size(&g_t32, 3, 0, 0) != T32_PROPS_E3 ||
	    spm_props_size(&g_t32, 0, 1, 0) != T32_PROPS_A1 || spm_props_size(&g_t32, 0, 0, 1) != T32_PROPS_H1 ||
	    spm_props_size(&g_t32, 5, 7, 16) != T32_PROPS_MIX) {
		g_warnings[g_nwarnings++] = spm_strdup("32-bit property table formula disagrees with probe32 (est32 property sizes unreliable)");
	}
#endif

	for (i = first_file; i < argc; i++) {
		duk_push_string(ctx, argv[i]);
		if (duk_safe_call(ctx, spm_run_file, NULL, 1, 1) != 0) {
			const char *msg;
			if (duk_is_error(ctx, -1)) {
				duk_get_prop_string(ctx, -1, "stack");
				msg = duk_safe_to_string(ctx, -1);
			} else {
				msg = duk_safe_to_string(ctx, -1);
			}
			fprintf(stderr, "%s: %s\n", argv[i], msg);
			{
				char buf[1024];
				snprintf(buf, sizeof(buf), "%s: %s", spm_basename(argv[i]), msg);
				g_fatal = spm_strdup(buf);
			}
			rc = 1;
			duk_pop(ctx);
			break;
		}
		duk_pop(ctx);
	}

	spm_write_report(out);
	duk_destroy_heap(ctx);
	if (g_live != 0) {
		fprintf(stderr, "note: %lu bytes still live after heap destruction\n", (unsigned long) g_live);
	}
	return rc;
}
