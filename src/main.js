import Vue from 'vue'
import VueRouter from 'vue-router'
import App from './App.vue'
// import Home from './Home.vue'
import 'bootstrap/dist/css/bootstrap.min.css'

Vue.use(VueRouter);

Vue.config.productionTip = false


const router = new VueRouter({
  mode: 'history'
});

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')
