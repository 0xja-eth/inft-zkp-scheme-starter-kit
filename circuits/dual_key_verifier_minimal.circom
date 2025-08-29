pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

/*
  Minimal dual-key verification circuit: proves two MACs were generated from 
  the same plaintext using two independent keys.
  
  This version removes ciphertext from public inputs and eliminates bit operations
  for maximum efficiency while maintaining security.
  
  Fixed 128 blocks (each block 16 bytes -> 1 field)
  Public inputs:
    nonce1, mac1      : First encryption nonce and MAC
    nonce2, mac2      : Second encryption nonce and MAC
  Private inputs:
    key1, key2        : Two independent keys
    msg[128]          : Common plaintext
*/

template PoseidonChain(N) {
    signal input in[N];
    signal output out;

    signal acc[N];

    component h0 = Poseidon(2);
    h0.inputs[0] <== 0;
    h0.inputs[1] <== in[0];
    acc[0] <== h0.out;

    component hs[N - 1];
    for (var i = 1; i < N; i++) {
        hs[i-1] = Poseidon(2);
        hs[i-1].inputs[0] <== acc[i-1];
        hs[i-1].inputs[1] <== in[i];
        acc[i] <== hs[i-1].out;
    }

    out <== acc[N - 1];
}

template DualKeyVerifierMinimal(N) {
    // Public inputs (only MACs and nonces)
    signal input nonce1;
    signal input mac1;
    signal input nonce2; 
    signal input mac2;

    // Private inputs
    signal input key1;
    signal input key2; 
    signal input msg[N];

    // First encryption path
    component h_state1 = Poseidon(2);
    h_state1.inputs[0] <== key1;
    h_state1.inputs[1] <== nonce1;

    component hks1[N];
    signal cipher1[N];
    
    for (var i = 0; i < N; i++) {
        hks1[i] = Poseidon(2);
        hks1[i].inputs[0] <== h_state1.out;
        hks1[i].inputs[1] <== i;
        
        // Simplified XOR: cipher1[i] = msg[i] + keystream[i] - 2*msg[i]*keystream[i]
        cipher1[i] <== msg[i] + hks1[i].out - 2 * msg[i] * hks1[i].out;
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

    // Second encryption path
    component h_state2 = Poseidon(2);
    h_state2.inputs[0] <== key2;
    h_state2.inputs[1] <== nonce2;

    component hks2[N];
    signal cipher2[N];
    
    for (var i = 0; i < N; i++) {
        hks2[i] = Poseidon(2);
        hks2[i].inputs[0] <== h_state2.out;
        hks2[i].inputs[1] <== i;
        
        cipher2[i] <== msg[i] + hks2[i].out - 2 * msg[i] * hks2[i].out;
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
}

component main {public [nonce1, mac1, nonce2, mac2]} = DualKeyVerifierMinimal(128);