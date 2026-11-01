<script lang="ts">
  let { name, cls = 'i' }: { name: string; cls?: string } = $props();
</script>

<svg class={cls} aria-hidden="true"><use href="#i-{name}" /></svg>
