<template>
  <div class="m-4 mt-5" id="app">
    <div class="container">
      <div class="row">
        <div class="col-12 text-center fs-1" :class="{ 'fw-bold': delta }">
          {{
            !isAuthTokenValid
              ? "??"
              : delta
              ? userDesiredTemperature
              : state
              ? state.reported.thermostat_temperature
              : "??"
          }}
        </div>
        <div class="col-12 text-center mb-2">Set Temperature</div>
        <div class="col-12 text-center fs-3">
          {{
            !isAuthTokenValid
              ? "??"
              : state && state.reported.measured_temperature
              ? Math.round(state.reported.measured_temperature)
              : "??"
          }}
        </div>
        <div class="col-12 text-center mb-5">Measured Temperature</div>
        <div class="col-5 offset-1 text-center">
          <button
            type="button"
            class="btn btn-secondary w-100"
            :disabled="isRequestInFlight || inErrorState || !isDeviceOnline"
            @click="updateUserDesiredTemperature(-1)"
          >
            decrease
          </button>
        </div>
        <div class="col-5 text-center mb-2">
          <button
            type="button"
            class="btn btn-secondary w-100"
            :disabled="isRequestInFlight || inErrorState || !isDeviceOnline"
            @click="updateUserDesiredTemperature(1)"
          >
            increase
          </button>
        </div>
        <div class="col-10 offset-1 text-center mb-2">
          <button
            type="button"
            :disabled="
              !(delta && !isRequestInFlight) || inErrorState || !isDeviceOnline
            "
            class="btn w-100"
            :class="{ 'btn-secondary': !delta, 'btn-success': delta }"
            @click="flight(updateSetTemperature, [userDesiredTemperature])"
          >
            update
          </button>
        </div>
        <div class="col-10 offset-1 text-center mb-5">
          <button
            type="button"
            class="btn btn-primary w-100"
            @click="flight(getDeviceShadowState)"
            :disabled="isRequestInFlight || !isAuthTokenValid"
          >
            refresh
          </button>
        </div>
        <div class="col-12 text-center d-flex justify-content-center mb-5">
          <span
            class="dot mx-2"
            :class="{
              'device-online': isDeviceOnline,
              'device-state-unknown': !isAuthTokenValid,
            }"
          ></span>
          <span>
            {{
              !isAuthTokenValid
                ? "Device state unknown"
                : isDeviceOnline
                ? "Device online"
                : "Device offline"
            }}
          </span>
        </div>
        <div class="col-12 text-center d-flex justify-content-center">
          <span class="input-group-text" id="basic-addon1">token</span>
          <input
            v-model="authToken"
            type="text"
            class="form-control"
            :class="[
              isAuthTokenValid
                ? 'is-valid'
                : authToken.length > 0
                ? 'is-invalid'
                : '',
            ]"
            placeholder=""
            :disabled="isAuthTokenValid"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "App",
  data() {
    return {
      setTemperature: null,
      userDesiredTemperature: null,
      measuredTemperature: null,
      state: null,
      metadata: null,
      isRequestInFlight: false,
      inErrorState: false,
      authToken: "",
      isAuthTokenValid: false,
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
      return false;
    },
    timeout() {
      return (
        4000 +
        Math.abs(
          this.state.reported.thermostat_temperature -
            this.userDesiredTemperature
        ) *
          1200
      );
    },
    isDeviceOnline() {
      if (this.state) {
        const reportedTimestamp =
          this.metadata.reported.thermostat_temperature.timestamp * 1000;
        if (Date.now() - reportedTimestamp < 60000 * 15) {
          // 15 minutes
          return true;
        }
      }
      return false;
    },
  },
  watch: {
    async authToken(token) {
      if (token.length === 36) {
        try {
          await this.flight(this.retry, [this.getDeviceShadowState, 1]);
          this.userDesiredTemperature =
            this.state.desired.thermostat_temperature;
          this.isAuthTokenValid = true;
        } catch (error) {
          this.isAuthTokenValid = false;
          console.log(error);
        }
      }
    },
  },
  methods: {
    async flight(fn, args) {
      console.log("in flight");
      this.isRequestInFlight = true;
      const result = await fn.apply(this, args);
      console.log("landed");
      this.isRequestInFlight = false;
      return result;
    },
    updateUserDesiredTemperature(by) {
      this.userDesiredTemperature += by;
      console.log(this.$route);
    },
    async updateSetTemperature(temperature) {
      const config = {
        method: "post",
        url: "https://vh3rmjhs10.execute-api.us-east-1.amazonaws.com/test/thermostat/state",
        headers: {
          authorization: this.authToken,
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
        await this.retry(this.getDeviceShadowState, 1);
      } catch (error) {
        console.log(error);
      }
    },
    async getDeviceShadowState() {
      console.log("getDeviceShadowState");
      const config = {
        method: "get",
        url: "https://vh3rmjhs10.execute-api.us-east-1.amazonaws.com/test/thermostat/state",
        headers: {
          authorization: this.authToken,
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
      this.metadata = response.data.metadata;

      // if there is delta, throw error
      if (this.state.delta) {
        this.inErrorState = true;
        throw new Error("State has delta");
      }
      this.inErrorState = false;
      console.log("refresh compelete");
      return;
    },
    async retry(fn, n) {
      for (let i = 0; i < n; i++) {
        console.log("retry");
        try {
          return await fn.call();
        } catch (error) {
          console.log(error);
          await this.wait(this.timeout);
        }
      }
      this.inErrorState = true;
      throw new Error("Retry maxed out - something is wrong");
    },
    wait(ms) {
      return new Promise((res) => setTimeout(res, ms));
    },
  },
  async beforeMount() {
    setInterval(() => {
      if (this.isAuthTokenValid && !this.isRequestInFlight) {
        try {
          this.getDeviceShadowState();
        } catch (error) {
          console.log(error);
        }
      }
    }, 60000);
  },
  mounted() {
    if (this.$route.query.t) {
      this.authToken = this.$route.query.t;
    }
  },
};
</script>

<style>
html,
body,
body > div {
  background-color: lightgrey !important;
}

.dot {
  height: 15px;
  width: 15px;
  margin-top: 5px;
  border-radius: 50%;
  display: inline-block;
  background-color: red;
}
.device-online {
  background-color: green;
  animation: blink 3s infinite;
}

.device-state-unknown {
  background-color: blueviolet;
}

/* Group same frames together */
@keyframes blink {
  0%,
  100% {
    opacity: 0;
  } /* more concise! */
  50% {
    opacity: 1;
  }
}
</style>
