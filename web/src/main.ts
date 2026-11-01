import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/instrument-sans/wght-italic.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';
import './app.css';
import { mount } from 'svelte';
import App from './components/App.svelte';

const target = document.getElementById('app');
if (target) mount(App, { target });
