<template>
  <div class="popup">
    <Dropdown
      v-if="tokens.length"
      :options="tokens"
      :method="changeToken"
      :selected="token"
      label="Select token"
    />
    <Input v-model="to" :label="$t('pages.manage-allowances.address')" :disabled="hasAllowance" />
    <Input
      v-model.number="amount"
      type="number"
      :label="$t('pages.manage-allowances.amount')"
      :disabled="hasAllowance"
    />
    <div v-if="exist">
      {{ $t('pages.manage-allowances.allowance-exist') }}
      <router-link :to="{ name: 'manage-allowances', params: { type: 'change' } }">
        {{ $t('pages.manage-allowances.here') }}
      </router-link>
    </div>
    <Button @click="allowanceAction" extend>
      {{ $t('pages.manage-allowances')[type] }}
    </Button>
    <Loader v-if="loading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { isEmpty } from 'lodash-es';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Dropdown from '../../components/Dropdown';

export default {
  props: {
    type: { type: String, required: true },
    allowance: { type: Object, required: false },
  },
  components: { Button, Input, Dropdown },
  data: () => ({
    tokens: [],
    token: null,
    to: null,
    amount: null,
    exist: false,
    loading: false,
  }),
  computed: {
    ...mapGetters(['account']),
    hasAllowance() {
      return !isEmpty(this.allowance);
    },
  },
  async created() {
    if (this.allowance) {
      // eslint-disable-next-line camelcase
      const { from_account, amount } = this.allowance;
      // eslint-disable-next-line camelcase
      this.to = from_account;
      this.amount = amount;
    }
    await this.$watchUntilTruly(() => this.$store.state.sdk);
    this.tokens = await this.$store.dispatch('tokens/extension', 'allowances');
    if (this.tokens.length) this.token = this.tokens[0].contract;
    if (this.allowance) this.token = this.allowance.contract;
  },
  methods: {
    async allowanceAction() {
      try {
        this.exist = false;
        this.loading = true;
        const { contract, balance } = this.tokens.find(t => t.contract === this.token) || {};
        if (this.amount > balance) {
          this.$store.dispatch('modals/open', {
            name: 'default',
            ...this.$t('modals.allowances.balance'),
          });
          return;
        }
        const instance = await this.$store.dispatch('tokens/instance', contract);
        const { decodedResult: allowance } = await instance.methods.allowance({
          from_account: this.account.publicKey,
          for_account: this.to,
        });

        if (this.type === 'create') {
          await instance.methods.create_allowance(this.to, this.amount);
        } else if (this.type === 'transfer') {
          if (allowance + this.amount >= allowance) {
            await instance.methods.transfer_allowance(this.to, this.account.publicKey, this.amount);
          }
        } else if (this.type === 'change') {
          await instance.methods.change_allowance(this.to, this.amount);
        }
        this.$store.dispatch('modals/open', {
          name: 'default',
          ...this.$t('modals.allowances')[this.type],
        });
        this.to = null;
        this.amount = null;
      } catch (e) {
        if (e.message.includes('ALLOWANCE_ALREADY_EXISTENT')) this.exist = true;
        this.$store.dispatch('modals/open', {
          name: 'default',
          title: 'Something went wrong',
          msg: e.message,
        });
      } finally {
        this.loading = false;
      }
    },
    changeToken(e) {
      this.token = e.target.value;
    },
  },
};
</script>
