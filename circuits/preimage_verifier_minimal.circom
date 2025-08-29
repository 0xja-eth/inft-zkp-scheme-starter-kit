pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

/*
  Minimal preimage verification circuit: proves knowledge of key and message
  that produce a specific MAC, without revealing the plaintext or ciphertext.
  
  This version eliminates bit operations and removes cipher from public inputs
  for maximum efficiency while maintaining security.
  
  Fixed 128 blocks (each block 16 bytes -> 1 field)
  Public inputs:
    nonce         : Field - encryption nonce
    mac           : Field - message authentication code
  Private inputs:
    key           : Field - encryption key
    msg[128]      : Field - plaintext message blocks
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

template PreimageVerifierMinimal(N) {
    // Public inputs (only nonce and MAC)
    signal input nonce;
    signal input mac;

    // Private inputs
    signal input key;
    signal input msg[N];

    // Generate state = Poseidon(key, nonce)
    component h_state = Poseidon(2);
    h_state.inputs[0] <== key;
    h_state.inputs[1] <== nonce;

    // Generate keystream and cipher without bit operations
    component hks[N];
    signal cipher[N];
    
    for (var i = 0; i < N; i++) {
        hks[i] = Poseidon(2);
        hks[i].inputs[0] <== h_state.out;
        hks[i].inputs[1] <== i;

        // Simplified XOR constraint without bit decomposition
        // cipher[i] = msg[i] + keystream[i] - 2*msg[i]*keystream[i]
        cipher[i] <== msg[i] + hks[i].out - 2 * msg[i] * hks[i].out;
    }

    // Generate MAC through cipher chain
    component chain = PoseidonChain(N);
    for (var j = 0; j < N; j++) {
        chain.in[j] <== cipher[j];
    }

    // Verify MAC = Poseidon(nonce, cipher_digest)
    component hmac = Poseidon(2);
    hmac.inputs[0] <== nonce;
    hmac.inputs[1] <== chain.out;

    mac === hmac.out;
}

component main {public [nonce, mac]} = PreimageVerifierMinimal(128);