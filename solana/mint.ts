import {
    sendAndConfirmTransaction,
    Connection,
    clusterApiUrl,
    Keypair,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
    PublicKey,
    Commitment,
    ConfirmOptions,
} from '@solana/web3.js';
import {
    getAccount,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createInitializeNonTransferableMintInstruction,
    createInitializeMintInstruction,
    getMintLen,
    ExtensionType,
    getOrCreateAssociatedTokenAccount,
    TOKEN_2022_PROGRAM_ID,
    mintTo,
    getAssociatedTokenAddress,
    transfer,
} from '@solana/spl-token';
import { utils } from '@project-serum/anchor';

class MintClass {
    public payer = Keypair.generate();
    constructor(){
        this.mintToken();
    }
    public async mintToken(){
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const mint= await this.NonTransferMintInitialize(connection,this.payer);
        const toWallet = Keypair.generate();
        await this.transferToken(connection,mint,this.payer.publicKey,toWallet.publicKey,this.payer,4);

        await this.getTokenAcount(connection, this.payer.publicKey, mint);
        await this.getTokenAcount(connection, toWallet.publicKey, mint);
    }

    public NonTransferMintInitialize =async (connection:Connection,payer:Keypair,commitment?:Commitment)=>{  

        const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction({ signature: airdropSignature, ...(await connection.getLatestBlockhash()) });
        console.log("payer", payer.publicKey.toString());
        const mintAuthority = Keypair.generate();
        const decimals = 9;
        console.log("mintAuthority:", mintAuthority.publicKey.toString());
        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;
        console.log("mint:", mint.toString());
        const mintLen = getMintLen([ExtensionType.NonTransferable]);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
        const freezeAuthority = Keypair.generate();
        console.log('freeze:', freezeAuthority.publicKey.toString());
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint,
                space: mintLen,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeNonTransferableMintInstruction(mint, TOKEN_2022_PROGRAM_ID),
            createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, freezeAuthority.publicKey, TOKEN_2022_PROGRAM_ID)
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            payer.publicKey,
            false,
            null,
            null,
            TOKEN_2022_PROGRAM_ID
          )
          
        console.log(tokenAccount.address.toBase58());
        await mintTo(
            connection,
            payer,
            mint,
            tokenAccount.address,
            mintAuthority,
            9e9,
            [],
            null,
            TOKEN_2022_PROGRAM_ID
          )
    
        return mint;
    }
    
    public transferToken = async(
        connection:Connection,
        mint:PublicKey,
        fromWallet:PublicKey,
        toWallet:PublicKey,
        payer:Keypair,
        amount:number,
        commitment?:Commitment,
        confirmOptions?:ConfirmOptions
        )=>{
            try{
                const fromAccount =await getOrCreateAssociatedTokenAccount(connection,payer,mint,fromWallet,false,commitment,confirmOptions,TOKEN_2022_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
                console.log("fromAccount",fromWallet.toString());
                
                const toAccount =await getOrCreateAssociatedTokenAccount(connection,payer,mint,toWallet,false,commitment,confirmOptions,TOKEN_2022_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
                console.log("toAccount",toWallet.toString())
                const signature  = await transfer(
                    connection,
                    payer,
                    fromAccount.address,
                    toAccount.address,
                    fromWallet,
                    amount*1e9,
                    [],
                    confirmOptions,
                    TOKEN_2022_PROGRAM_ID
                );
            }catch(error){
                console.log(error);
            }
    }
    
    public async getTokenAcount(connection:Connection,owner:PublicKey,mint:PublicKey,programId=TOKEN_2022_PROGRAM_ID,commitment?:Commitment){
        const associatedToken = await getAssociatedTokenAddress(
            mint,
            owner,
            false,
            programId,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log("token--------------",associatedToken.toBase58());
        const account = await getAccount(connection, associatedToken, commitment, programId);
        console.log(account.amount);
        return account;
    }
    
}
export default MintClass;