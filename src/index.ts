import * as filecoin_signer from '@zondax/filecoin-signing-tools'
import blake from 'blakejs'
import btoa from 'btoa'
// import * as filecoin_signer_js from '@zondax/filecoin-signing-tools/js'
const cbor = require('ipld-dag-cbor').util
// const FilecoinRPC = require('@zondax/filecoin-signing-tools/utils')
const axios = require('axios')
class FilecoinRPC {
  requester
  constructor(args) {
    if (!('url' in args && 'token' in args)) {
      throw new Error(
        'FilecoinRPC required an `url` and a `token` to communicate with the node.',
      )
    }

    this.requester = axios.create({
      baseURL: args.url,
      headers: { Authorization: `Bearer ${args.token}` },
    })
  }

  async getNonce(address) {
    let response = await this.requester.post('', {
      jsonrpc: '2.0',
      method: 'Filecoin.MpoolGetNonce',
      id: 1,
      params: [address],
    })

    return response.data
  }

  async sendSignedMessage(signedMessage) {
    let response = await this.requester.post('', {
      jsonrpc: '2.0',
      method: 'Filecoin.MpoolPush',
      id: 1,
      params: [signedMessage],
    })
    console.log(response.data)
    if ('error' in response.data) {
      throw new Error(response.data.error.message)
    }

    let cid = response.data.result

    response = await this.requester.post('', {
      jsonrpc: '2.0',
      method: 'Filecoin.StateWaitMsg',
      id: 1,
      params: [cid, null],
    })

    return response.data
  }

  async getGasEstimation(message) {
    let response = await this.requester.post('', {
      jsonrpc: '2.0',
      method: 'Filecoin.GasEstimateMessageGas',
      id: 1,
      params: [message, { MaxFee: '0' }, null],
    })

    return response.data
  }

  async readState(address) {
    let response = await this.requester.post('', {
      jsonrpc: '2.0',
      method: 'Filecoin.StateReadState',
      id: 1,
      params: [address, null],
    })

    return response.data
  }
}

// const URL = 'http://155.138.237.174:1234/rpc/v0'
// const URL =
// 'https://1lCuwxgriwRrtpFtiRVQxmmVc64:49c571179d5f0dd7e4618f8a352445e2@filecoin.infura.io'
// const TOKEN =
// 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJBbGxvdyI6WyJyZWFkIiwid3JpdGUiLCJzaWduIiwiYWRtaW4iXX0.YDdsllK_FZ-I1mzdoEym_LC2uWtsMzqiuTxEmE4mWQY'

// TESTNET
const URL = 'http://45.32.223.238:1234/rpc/v0'
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJBbGxvdyI6WyJyZWFkIiwid3JpdGUiLCJzaWduIiwiYWRtaW4iXX0.O1839mDt_AO5lDfTx1FTTaO4ROrTVNKgB4S8re0UouQ'

const filRPC = new FilecoinRPC({ url: URL, token: TOKEN })

const privateKeyBase64 = 'YzPHu1i6raDvD4VF1+XjjMHxyuDyd6JvrPK7R1IDVcQ='
// const privateKeyBase64 = 'YbDPh1vq3fBClzbiwDt6WjniAdZn8tNcCwcBO2hDwyk'
const privateKey = Buffer.from(privateKeyBase64, 'base64')

// const recipient = 'f1bzxzmxme33lg5sstuq7hhuphejgwac4wyvw7bjq'
const recipient = 't137sjdbgunloi7couiy4l5nc7pd6k2jmq32vizpy'

const main = async () => {
  /* Recover address */
  console.log('##### RECOVER ADDRESS #####')

  let recoveredKey = filecoin_signer.keyRecover(privateKeyBase64, true)
  console.log(recoveredKey.address)

  /* Get nonce */
  console.log('##### GET NONCE #####')

  let nonce = await filRPC.getNonce(recoveredKey.address)
  nonce = nonce.result
  console.log(nonce)

  /* Serialize params */
  const from = recoveredKey.address
  const to = recipient

  // constructor params
  const constructor_params = { from, to }

  const params = {
    code_cid: 'fil/3/paymentchannel',
    constructor_params: Buffer.from(
      filecoin_signer.serializeParams(constructor_params),
    ).toString('base64'),
  }

  // https://github.com/Zondax/filecoin-signing-tools/blob/ccefd77dedcae1bab894e7fc111f2ffda8fb1dfe/docs/wasm_api.md#serializeparams
  // https://github.com/Zondax/filecoin-signing-tools/blob/4048cc6ccc7b3d37964d0d582f95c63bc5a5f637/signer/src/lib.rs#L795
  // https://github.com/Zondax/filecoin-signing-tools/blob/master/signer-npm/js/src/index.js
  // https://github.com/Zondax/filecoin-signing-tools/blob/master/signer-npm/js/src/methods.js
  // https://github.com/Zondax/filecoin-signing-tools/blob/master/examples/wasm_node/payment_channel.js
  const serialized_params = filecoin_signer.serializeParams(params)
  //   console.log(serialized_params.toString('base64'))
  //   console.log(Buffer.from(serialized_params).toString('base64'))

  const message = {
    from,
    to: 't01',
    nonce,
    value: '10000000000000000',
    gasprice: '20000000000',
    gaslimit: 200000000,
    method: 2, // Exec
    params: Buffer.from(serialized_params).toString('base64'),
  }

  const response = await filRPC.getGasEstimation(message)
  // console.log(response)

  const signedMessage = JSON.parse(
    filecoin_signer.transactionSignLotus(response.result, privateKey),
  )
  // console.log(signedMessage)

  // try {
  //   console.log('SEND_MESSAGE')
  //   const tx_response = await filRPC.sendSignedMessage(signedMessage)
  //   console.log(tx_response)
  // } catch (e) {
  //   console.log(e)
  // }

  // Voucher References
  // https://github.com/Zondax/filecoin-signing-tools/blob/4048cc6ccc7b3d37964d0d582f95c63bc5a5f637/signer-npm/src/lib.rs
  // https://github.com/Zondax/filecoin-signing-tools/blob/dev/signer/src/lib.rs
  // https://github.com/Zondax/filecoin-signing-tools/blob/master/signer-npm/js/src/index.js
  // https://github.com/filecoin-project/specs-actors/blob/ed4cfa459568cf5d9afb9b4951a34f97a2e6d48c/actors/builtin/paych/paych_actor.go

  /* Create Voucher */

  console.log('##### CREATE VOUCHER #####')
  const payment_channel_address = 't07361'
  const time_lock_min = '0'
  const time_lock_max = '0'
  const secret = blake.blake2bHex('secret')
  const secret_pre_image = blake.blake2bHex(secret) // preimage
    console.log(secret_pre_image)
    // console.log(typeof secret_pre_image)
    // return
  const amount = '100000'
  const lane = '0'
  const nonce_voucher = 0
  const min_settle_height = '0'
  const voucher = filecoin_signer.createVoucher(
    payment_channel_address,
    time_lock_min,
    time_lock_max,
    secret_pre_image,
    amount,
    lane,
    nonce_voucher,
    min_settle_height,
  )
  console.log(voucher)

  console.log('##### SIGN VOUCHER #####')

  const signedVoucher = filecoin_signer.signVoucher(voucher, privateKey)
  console.log(signedVoucher)

  console.log('##### VERIFY VOUCHER #####')
  console.log(filecoin_signer.verifyVoucherSignature(signedVoucher, from))

  // UPDATE PAYMENT CHANNEL
  // REDEEM VOUCHER
  // https://github.com/filecoin-project/specs-actors/blob/ed4cfa459568cf5d9afb9b4951a34f97a2e6d48c/actors/builtin/paych/paych_actor.go#L96
  console.log('##### REDEEM VOUCHER #####')

  // Get Nonce
  let redeem_nonce = await filRPC.getNonce(from)
  redeem_nonce = redeem_nonce.result

  // Update Payment Channel Message
  let update_paych_message = filecoin_signer.updatePymtChan(
    payment_channel_address,
    to,
    signedVoucher,
    secret,
    redeem_nonce,
    '0', // gas_limit
    '0', // gas_fee_cap,
    '0', // gas_premium
  )

  console.log(update_paych_message)
  update_paych_message = await filRPC.getGasEstimation(update_paych_message)
  console.log(update_paych_message)
}

main()
