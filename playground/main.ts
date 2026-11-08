import '@dskripchenko/ui/styles/all.css'
import { createApp } from 'vue'
import App from './App.vue'

const params = new URLSearchParams(location.search)
document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light'
document.documentElement.lang = params.get('locale') === 'ru' ? 'ru' : 'en'
createApp(App).mount('#app')
