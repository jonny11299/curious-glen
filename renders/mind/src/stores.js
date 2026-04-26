import { writable } from 'svelte/store';

export const currentView = writable('sessions');
export const keypress = writable(null);
