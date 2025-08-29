pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

/*
  Preimage verification circuit: proves knowledge of key and message
  that produce specific nonce, MAC, and ciphertext.
  
  Fixed 128 blocks (each block 16 bytes -> 1 field)
  Public inputs:
    nonce         : Field - encryption nonce
    mac           : Field - message authentication code
    cipher[128]   : Field - ciphertext blocks
  Private inputs:
    key           : Field - encryption key
    msg[128]      : Field - plaintext message blocks
*/
template PoseidonChain(N) {
    signal input in[N];
    signal output out;

    // declare 128 signals for accumulator
    signal acc[N];

    // first
    component h0 = Poseidon(2);
    h0.inputs[0] <== 0;
    h0.inputs[1] <== in[0];
    acc[0] <== h0.out;

    // declare 127 Poseidon components statically
    component hs[N - 1];
    for (var i = 1; i < N; i++) {
        hs[i-1] = Poseidon(2);
        hs[i-1].inputs[0] <== acc[i-1]; // use previous acc[i-1]
        hs[i-1].inputs[1] <== in[i];
        acc[i] <== hs[i-1].out; // assign once
    }

    out <== acc[N - 1];
}

template PreimageVerifier(N) {
    // public
    signal input nonce;
    signal input mac;

    // private
    signal input key;
    signal input msg[N];
    signal input cipher[N];

    // state = Poseidon(key, nonce)
    component h_state = Poseidon(2);
    h_state.inputs[0] <== key;
    h_state.inputs[1] <== nonce;
    signal state;
    state <== h_state.out;

    // ks components - constrain keystream to 128 bits using bit decomposition
    component hks[N];

    component toBits254[N];
    component ksBits[N];
    component fromBits128[N];

    component msgBitsArr[N];
    component cipherBitsArr[N];

    // component toBits[N];
    // component fromBits[N];

    signal ks[N];
    
    for (var i = 0; i < N; i++) {
        hks[i] = Poseidon(2);
        hks[i].inputs[0] <== state;
        hks[i].inputs[1] <== i;

        // Decompose Poseidon output to 254 bits
        toBits254[i] = Num2Bits(254);
        toBits254[i].in <== hks[i].out;

        // Keep only low 128 bits
        ksBits[i] = Bits2Num(128);
        for (var b = 0; b < 128; b++) {
            ksBits[i].in[b] <== toBits254[i].out[b]; // low 128 bits
        }
        ks[i] <== ksBits[i].out;

        // Decompose to 128 bits and recompose to enforce 128-bit constraint
        // toBits[i] = Num2Bits(128);
        // fromBits[i] = Bits2Num(128);

        // toBits[i].in <== hks[i].out;
        // fromBits[i].in <== toBits[i].out;
        // ks[i] <== fromBits[i].out;

        // XOR constraint: cipher[i] == msg[i] XOR ks[i]
        // In finite field: a XOR b = a + b - 2*a*b

        msgBitsArr[i] = Num2Bits(128);
        msgBitsArr[i].in <== msg[i];

        cipherBitsArr[i] = Bits2Num(128);
        for (var b = 0; b < 128; b++) {
            cipherBitsArr[i].in[b] <== msgBitsArr[i].out[b] + ksBits[i].in[b] - 2 * msgBitsArr[i].out[b] * ksBits[i].in[b];
        }
        cipher[i] === cipherBitsArr[i].out;

        // cipher[i] === msg[i] + ks[i] - 2 * msg[i] * ks[i];
    }

    // digest chain over cipher[0..127]
    component chain = PoseidonChain(N);
    for (var j = 0; j < N; j++) {
        chain.in[j] <== cipher[j];
    }

    // mac_check = Poseidon(nonce, digest)
    component hmac = Poseidon(2);
    hmac.inputs[0] <== nonce;
    hmac.inputs[1] <== chain.out;

    mac === hmac.out;
}

component main {public [nonce, mac]} = PreimageVerifier(128);
