<script setup lang="ts">
const { t } = useI18n()
//เรียกใช้ ตัวเเปรนี้เพื่อเก็บท่อข้อมูล ใช้ยิงคำสั่งไปยังฐานข้อมูล supabase
const supabase = useSupabaseClient()

const query = ref('') //เก็บค่าผู้ใช้พิมพ์ในช่องค้นหา
const open = ref(false)//เก็บค่าสถานะ ว่าปิดหรือเปิด
const root = ref<HTMLElement | null>(null) //เก็บค่าตัวเเปร DOM เพื่อที่ว่าพอวาดเสร็จปุ๊บเราจะได้เอามันไปใช้งาน
onClickOutside(root, () => (open.value = false))//คลิกนอกกล่องให้ปิดกล่องค้นหา

//กำหนดตค่าเริ่มต้น ชื่อทีม เเละโปรเจค เป็นเเอเรียว่าง เเละกำหนดชนิดข้อมูล
const workspaces = ref<{ id: string; name: string }[]>([])
const projects = ref<{ id: string; name: string; workspace: { name: string } | null }[]>([])

//โหลดข้อมูลจาก supbase มาเก็ฐไว้ในตัวเเปร เเละ onmounted เพื่อโหลดข้อมูลมาเเสดงผลที่โหลดหน้าเว็บ
async function load() {
  const [w, p] = await Promise.all([
    supabase.from('workspaces').select('id, name'),
    supabase.from('projects').select('id, name, workspace:workspaces (name)')
  ])
  workspaces.value = w.data ?? []
  projects.value = (p.data ?? []) as typeof projects.value
}
onMounted(load)

//กรองข้อมูลที่ผู็ใช้พิพ์ฬนช่องค้นหา เเละเเสดงผลลัพทธ์ที่ตรงเเละจำกัดจำนวนที่เเสดงผลไม่เกิน 5 รายการ
const q = computed(() => query.value.trim().toLowerCase())
const wsResults = computed(() =>
  q.value ? workspaces.value.filter((x) => x.name.toLowerCase().includes(q.value)).slice(0, 5) : []
)
const projResults = computed(() =>
  q.value
    ? projects.value
        .filter(
          (x) =>
            x.name.toLowerCase().includes(q.value) ||
            (x.workspace?.name ?? '').toLowerCase().includes(q.value)
        )
        .slice(0, 6)
    : []
)

//เช็คจำนวนผลลัพธ์ได้ได้จากการค้นหาว่ามีหรือไม่
const hasResults = computed(() => wsResults.value.length > 0 || projResults.value.length > 0)

//คลิกเลือกเเล้วให้ปิดกล่องเเละล้างค่าที่พิมพ์ในช่องค้นหา
function pick() {
  open.value = false
  query.value = ''
}
</script>

//เก็บคำค้นหาไว้ในตัวเเปร place สลับภาษา การเปิดกล่องด้วยเม้าส์คลิก
<template>
  <div ref="root" class="relative hidden max-w-sm flex-1 sm:block">
    <div class="relative flex items-center">
      <AppIcon name="search" class="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" />
      <input
        v-model="query"
        type="text"
        :placeholder="`${t('common.search')}...`"
        class="w-full rounded-lg border border-border bg-surface-alt py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:bg-surface focus:outline-none"
        @focus="open = true"
      />
    </div>

    <!-- อนิเมชั่นในการเปิดปิดกล่องค้นหา -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <!-- ควบคุมการเปิด-ปิดกล่องdropdown -->
      <div
        v-if="open"
        class="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-modal"
      >
          <!-- เปิดกล่องเเต่ยังไม่ได้พิมพ์ ไม่มีผลลัพธ์ -->
        <p v-if="!q" class="px-4 py-3 text-sm text-text-muted">{{ t('search.hint') }}</p>

        <!-- พิมพ์เเล้วเเต่ไม่เจอผลลัพธ์ -->
        <p v-else-if="!hasResults" class="px-4 py-3 text-sm text-text-muted">
          {{ t('search.noResults') }}
        </p>
        <!--มีผลลัพธ์ ถ้ามีก็เขียนหัวข้อโชว์ ข้อมูลแต่ละอันมาสร้างเป็นลิงก์พร้อมไอคอนเรียงต่อกันลงมาให้ผู้ใช้คลิก-->
        <template v-else>
          <template v-if="wsResults.length">
            <p class="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              {{ t('search.workspaces') }}
            </p>
            <NuxtLink
              v-for="ws in wsResults"
              :key="ws.id"
              :to="`/workspaces/${ws.id}`"
              class="mx-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-alt"
              @click="pick"
            >
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name="workspace" class="h-4 w-4" />
              </span>
              <span class="truncate text-text">{{ ws.name }}</span>
            </NuxtLink>
          </template>

          <template v-if="projResults.length">
            <p class="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              {{ t('search.projects') }}
            </p>
            <NuxtLink
              v-for="p in projResults"
              :key="p.id"
              :to="`/projects/${p.id}`"
              class="mx-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-alt"
              @click="pick"
            >
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                <AppIcon name="projects" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1 truncate text-text">{{ p.name }}</span>
              <span class="shrink-0 truncate text-xs text-text-muted">{{ p.workspace?.name }}</span>
            </NuxtLink>
          </template>
        </template>
      </div>
    </Transition>
  </div>
</template>
