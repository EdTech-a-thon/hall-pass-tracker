import './style.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { bootstrap } from './lib/store.svelte';

// Restore a linked kiosk before the first screen paints, so a valid classroom
// device never flashes the sign-in page.
await bootstrap();

mount(App, { target: document.querySelector<HTMLDivElement>('#app')! });
