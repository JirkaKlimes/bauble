<script lang="ts">
  import type { MemberId } from '../lib/domain/types';
  import { portraits } from '../lib/portraits.svelte';

  let { id, size = '' }: { id: MemberId; size?: '' | 'xs' | 'sm' | 'md' | 'lg' } = $props();
</script>

<span class="avatar {size}">
  <img src={portraits.url(id) || undefined} alt="" />
  <svg class="hat santa" viewBox="0 0 120 92" aria-hidden="true"><use href="#hat2d" /></svg>
  <svg class="hat party" viewBox="0 0 60 80" aria-hidden="true"><use href="#party2d" /></svg>
</span>
