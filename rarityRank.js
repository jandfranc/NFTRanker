const Web3 = require('web3');
const axios = require('axios')
const fs = require('fs')
const abi = require('./abi.json')


const contractAddress = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const provider = new Web3.providers.HttpProvider('INFURA_ADDRESS')
const web3 = new Web3(provider)
const contract = new web3.eth.Contract(abi, contractAddress)


async function getTotalSupply() {
    try {
        const totalSupply = await contract.methods.totalSupply().call()
        return parseInt(totalSupply)

    } catch (error) {
        console.error('Error getting total supply', error)
        return 0
    }
}

async function fetchNftData(id) {
    try {
        const uri = await contract.methods.tokenURI(id).call()
        const fixedUri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/') //Check
        const response = await axios.get(fixedUri)
        return response.data

    } catch (error) {
        console.error('Error getting token: ', id, error)
        return null
    }
}

async function getSubcollection(totalSupply) {
    const tokenIds = []
    const collectionIter = 100;
    const batchSize = 10;
    const timeoutBetweenBatch = 1000;
    for (let i = 0; i < totalSupply; i += collectionIter) {
        tokenIds.push(i)
    }

    const subCollection = []
    // Step 1: fetch and put in array, and filter to only have items with index multiple of 100
    for (let i = 0; i < tokenIds.length; i += batchSize) {
        const batchIds = tokenIds.slice(i, i + batchSize);
        const tokenBatchPromises = batchIds.map(id => fetchNftData(id))
        const tokenBatchArr = await Promise.all(tokenBatchPromises)

        //Clean array
        const processedBatch = tokenBatchArr
            .filter(item => item)
            .map((item, id) => {
                const attributes = item.attributes
                return { id: batchIds[id], traits: attributes }
            })
        subCollection.push(...processedBatch)
        //Avoid rate limit
        if (i + 10 < tokenIds.length) {
            await new Promise(resolve => setTimeout(resolve, timeoutBetweenBatch))
        }
    }
    return subCollection
}

async function getRarity(collection) {
    //Ranking algorithm
    // use reciprocal rarity
    const tokenOccurences = new Map()
    collection.map(item => {
        item.traits.map(trait => {
            //by trait type and trait value
            const traitTypeMap = tokenOccurences.get(trait.trait_type) || new Map()
            const counter = traitTypeMap.get(trait.value) || 0
            traitTypeMap.set(trait.value, counter + 1)
            tokenOccurences.set(trait.trait_type, traitTypeMap)
        })
    })

    collection.map(item => {
        rarity = 0
        item.traits.map(trait => {
            //by trait type and trait value
            const traitTypeMap = tokenOccurences.get(trait.trait_type)
            const counter = traitTypeMap.get(trait.value)
            rarity += 1 / counter
        })
        item.rarity = rarity
    })
    return collection


}

async function main() {
    const totalSupply = await getTotalSupply()
    const collection = await getSubcollection(totalSupply)
    const collectionWithRarity = await getRarity(collection)
    collectionWithRarity.sort((a, b) => b.rarity - a.rarity)
    fs.writeFileSync('rarityRankings.json', JSON.stringify(collectionWithRarity, null, 2))
}

main()
