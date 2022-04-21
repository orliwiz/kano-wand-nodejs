resources - http://mcra.t8o.org/2019/12/26/kano-coding.html

not 100% on replicability of below, will test again to see exactly how it works now that I got it running on my pi

    1. Flash pi w/ ssh and wifi info
    2. add pi to vscode ssh
    3. clone grpc directory to local
    4. install nvm
    5. npm rebuild @tensorflow/tfjs-node --build-from-source
    6. npm install
    7. systemctl enable bluetooth
    8. 

https://github.com/tensorflow/tfjs/issues/5937 – current issue is that tfjs-node doesn’t work on arm-64 so i'm on the 32 bit version, thus step 5