<template>
  <div id="app">
    <div>
      <div>
        user desired:
        {{ userDesiredTemperature }}
      </div>
      <div>
        desired:
        {{ state ? state.desired.thermostat_temperature : "??" }}
      </div>
      <div>
        reported:
        {{ state ? state.reported.thermostat_temperature : "??" }}
      </div>
      <div>
        measured:
        {{
          state && state.reported.measured_temperture
            ? state.reported.measured_temperture
            : "??"
        }}
      </div>
    </div>

    <button
      type="button"
      class="btn btn-secondary"
      :disabled="isRequestInFlight"
      @click="updateUserDesiredTemperature(1)"
    >
      increase
    </button>
    <button
      type="button"
      class="btn btn-secondary"
      :disabled="isRequestInFlight"
      @click="updateUserDesiredTemperature(-1)"
    >
      decrease
    </button>
    <button
      type="button"
      :disabled="!(delta && !isRequestInFlight)"
      class="btn"
      :class="{ 'btn-secondary': !delta, 'btn-success': delta }"
      @click="flight(updateSetTemperature(userDesiredTemperature))"
    >
      update
      <!-- <div v-if="!isRequestInFlight">update</div> -->
      <!-- <div v-else class="spinner-border spinner-border-sm" role="status"></div> -->
    </button>
    <button type="button" class="btn btn-primary" @click="flight(getDeviceShadowState())" :disabled="isRequestInFlight">
      refresh
      <!-- <div v-if="!isRequestInFlight">refresh</div>
      <div v-else class="spinner-border spinner-border-sm" role="status"></div> -->
    </button>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "App",
  data() {
    return {
      setTemperature: 72,
      userDesiredTemperature: null,
      measuredTemperature: null,
      isDeviceOnline: false,
      state: null,
      isRequestInFlight: false,
    };
  },
  computed: {
    delta() {
      if (this.state) {
        return !(
          this.state.desired.thermostat_temperature ===
          this.userDesiredTemperature
        );
      }
      return true;
    },
    timeout() {
      return (
        4000 +
        Math.abs(
          this.state.reported.thermostat_temperature -
            this.userDesiredTemperature
        ) *
          1000
      );
    },
  },
  methods: {
    // todo - fix function wrapping 
    async flight(fn) {
      console.log('in flight')
      this.isRequestInFlight = true;
      const result = await fn;
      console.log('landed')
      this.isRequestInFlight = false;
      return result;
    },
    updateUserDesiredTemperature(by) {
      this.userDesiredTemperature += by;
    },
    async updateSetTemperature(temperature) {
      const config = {
        method: "post",
        url: "https://vh3rmjhs10.execute-api.us-east-1.amazonaws.com/test/thermostat/state",
        headers: {
          // ! todo - CHANGE AUTH TOKEN BEFORE PUSHING TO GITHUB
          authorization: "a31a7655-a633-4a1c-b044-7c20609d1d45",
          "Content-Type": "application/json",
        },
        data: {
          state: { desired: { thermostat_temperature: temperature } },
        },
      };

      try {
        // make post request to update shadow state
        // await this.flight(async () => await axios(config));
        await axios(config);
      } catch (error) {
        console.log(error);
      }

      await this.wait(this.timeout);
      try {
        await this.retry(this.getDeviceShadowState, 2);
      } catch (error) {
        // show warning
        console.log(error);
      }
    },
    async getDeviceShadowState() {
      const config = {
        method: "get",
        url: "https://vh3rmjhs10.execute-api.us-east-1.amazonaws.com/test/thermostat/state",
        headers: {
          // ! todo - REMOVE BEFORE PUSHING TO GITHUB
          authorization: "a31a7655-a633-4a1c-b044-7c20609d1d45",
          "Content-Type": "application/json",
        },
      };

      // get the device shadow state
      let response;
      try {
        response = await axios(config);
      } catch (error) {
        throw new Error("API call failed");
      }

      this.state = response.data.state;

      // if there is delta, throw error
      if (this.state.delta) {
        throw new Error("state has delta");
      }
      console.log("refresh compelete");
      return;
    },
    async retry(fn, n) {
      for (let i = 0; i < n; i++) {
        console.log('retry')
        try {
          return await fn();
        } catch (error) {
          console.log(error);
          await this.wait(this.timeout);
        }
      }
      throw new Error("something is wrong");
    },
    wait(ms) {
      return new Promise((res) => setTimeout(res, ms));
    },
  },
  async beforeMount() {
    await this.flight(this.retry(this.getDeviceShadowState, 1))
    this.userDesiredTemperature = this.state.desired.thermostat_temperature;
  },
};
</script>

<style>
html,
body > div {
  background-color: lightcoral;
}
</style>
