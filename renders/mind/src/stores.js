import { writable } from 'svelte/store';

export const currentView = writable('memories');
export const keypress = writable(null);
