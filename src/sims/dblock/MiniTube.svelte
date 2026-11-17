<script lang="ts">
  /* A small test tube for cards and flowchart boxes: the solution, with a settled precipitate if there is one. */
  import { tubeVars, type Species } from './data';
  let { S }: { S: Species } = $props();
</script>

<span class="mini" style={tubeVars(S)}>{#if S.ppt}<i></i>{/if}</span>
