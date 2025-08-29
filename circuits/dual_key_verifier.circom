pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

/*
  Dual-key verification circuit: proves two MACs were generated from the same plaintext
  using two independent keys.
  
  Fixed 128 blocks (each block 16 bytes -> 1 field)
  Public inputs:
    nonce1, mac1      : First encryption nonce and MAC
    nonce2, mac2      : Second encryption nonce and MAC  
    cipher1[128]      : First encryption ciphertext
    cipher2[128]      : Second encryption ciphertext
  Private inputs:
    key1, key2        : Two independent keys
    msg[128]          : Common plaintext
*/

template PoseidonChain(N) {
    signal input in[N];
    signal output out;

    // declare N signals for accumulator
    signal acc[N];

    // first
    component h0 = Poseidon(2);
    h0.inputs[0] <== 0;
    h0.inputs[1] <== in[0];
    acc[0] <== h0.out;

    // declare N-1 Poseidon components statically
    component hs[N - 1];
    for (var i = 1; i < N; i++) {
        hs[i-1] = Poseidon(2);
        hs[i-1].inputs[0] <== acc[i-1]; // use previous acc[i-1]
        hs[i-1].inputs[1] <== in[i];
        acc[i] <== hs[i-1].out; // assign once
    }

    out <== acc[N - 1];
}

template DualKeyVerifier(N) {
    // Public inputs
    signal input nonce1;
    signal input mac1;
    signal input nonce2; 
    signal input mac2;
    signal input cipher1[N];
    signal input cipher2[N];

    // Private inputs
    signal input key1;
    signal input key2; 
    signal input msg[N];

    // First encryption verification
    
    // state1 = Poseidon(key1, nonce1)
    component h_state1 = Poseidon(2);
    h_state1.inputs[0] <== key1;
    h_state1.inputs[1] <== nonce1;
    signal state1;
    state1 <== h_state1.out;

    // Generate first keystream
    component hks1[N];
    component toBits254_1[N];
    component ksBits1[N];
    component msgBitsArr1[N];
    component cipherBitsArr1[N];
    
    signal ks1[N];
    
    for (var i = 0; i < N; i++) {
        hks1[i] = Poseidon(2);
        hks1[i].inputs[0] <== state1;
        hks1[i].inputs[1] <== i;

        // Decompose Poseidon output to 254 bits
        toBits254_1[i] = Num2Bits(254);
        toBits254_1[i].in <== hks1[i].out;

        // Keep only low 128 bits
        ksBits1[i] = Bits2Num(128);
        for (var b = 0; b < 128; b++) {
            ksBits1[i].in[b] <== toBits254_1[i].out[b]; // low 128 bits
        }
        ks1[i] <== ksBits1[i].out;

        // XOR constraint: cipher1[i] == msg[i] XOR ks1[i]
        msgBitsArr1[i] = Num2Bits(128);
        msgBitsArr1[i].in <== msg[i];

        cipherBitsArr1[i] = Bits2Num(128);
        for (var b = 0; b < 128; b++) {
            cipherBitsArr1[i].in[b] <== msgBitsArr1[i].out[b] + ksBits1[i].in[b] - 2 * msgBitsArr1[i].out[b] * ksBits1[i].in[b];
        }
        cipher1[i] === cipherBitsArr1[i].out;
    }

    // First MAC verification
    component chain1 = PoseidonChain(N);
    for (var j = 0; j < N; j++) {
        chain1.in[j] <== cipher1[j];
    }

    component hmac1 = Poseidon(2);
    hmac1.inputs[0] <== nonce1;
    hmac1.inputs[1] <== chain1.out;

    mac1 === hmac1.out;

    // Second encryption verification
    
    // state2 = Poseidon(key2, nonce2)
    component h_state2 = Poseidon(2);
    h_state2.inputs[0] <== key2;
    h_state2.inputs[1] <== nonce2;
    signal state2;
    state2 <== h_state2.out;

    // Generate second keystream
    component hks2[N];
    component toBits254_2[N];
    component ksBits2[N];
    component msgBitsArr2[N];
    component cipherBitsArr2[N];
    
    signal ks2[N];
    
    for (var i = 0; i < N; i++) {
        hks2[i] = Poseidon(2);
        hks2[i].inputs[0] <== state2;
        hks2[i].inputs[1] <== i;

        // Decompose Poseidon output to 254 bits
        toBits254_2[i] = Num2Bits(254);
        toBits254_2[i].in <== hks2[i].out;

        // Keep only low 128 bits
        ksBits2[i] = Bits2Num(128);
        for (var b = 0; b < 128; b++) {
            ksBits2[i].in[b] <== toBits254_2[i].out[b]; // low 128 bits
        }
        ks2[i] <== ksBits2[i].out;

        // XOR constraint: cipher2[i] == msg[i] XOR ks2[i]
        // Note: using same msg[i]
        msgBitsArr2[i] = Num2Bits(128);
        msgBitsArr2[i].in <== msg[i];

        cipherBitsArr2[i] = Bits2Num(128);
        for (var b = 0; b < 128; b++) {
            cipherBitsArr2[i].in[b] <== msgBitsArr2[i].out[b] + ksBits2[i].in[b] - 2 * msgBitsArr2[i].out[b] * ksBits2[i].in[b];
        }
        cipher2[i] === cipherBitsArr2[i].out;
    }

    // Second MAC verification
    component chain2 = PoseidonChain(N);
    for (var j = 0; j < N; j++) {
        chain2.in[j] <== cipher2[j];
    }

    component hmac2 = Poseidon(2);
    hmac2.inputs[0] <== nonce2;
    hmac2.inputs[1] <== chain2.out;

    mac2 === hmac2.out;

    // Key independence verification
    // Ensure key1 != key2 (optional constraint)
    component keyDiff = IsZero();
    keyDiff.in <== key1 - key2;
    keyDiff.out === 0; // constraint fails if keys are equal
}

component main {public [nonce1, mac1, nonce2, mac2]} = DualKeyVerifier(128);