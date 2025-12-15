/**
 * Metin2 Game Patcher Module
 *
 * Handles file verification and downloading for Metin2 private servers
 *
 * CONFIGURATION REQUIRED:
 * Update the URLs below to point to your server's manifest and file hosting
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const https = require('https')
const { app } = require('@electron/remote')

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES FOR YOUR SERVER
// ============================================================================

// URL to your manifest.json file (contains list of all game files and hashes)
const MANIFEST_URL = 'https://yoursite.com/game/manifest.json'

// Base URL where game files are hosted (files will be downloaded from: BASE_URL + file.path)
const FILES_BASE_URL = 'https://yoursite.com/game/files/'

// Game folder name (will be created in Documents folder)
// Example: 'YourServerName' will create Documents/YourServerName/
const GAME_FOLDER_NAME = 'YourServerName'

// ============================================================================

class AscendPatcher {
    constructor() {
        this.gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME)
        this.manifest = null
        this.filesToDownload = []
        this.downloadProgress = 0
        this.totalFiles = 0
        this.currentFileIndex = 0
        
        // Cache pour le manifest
        this.manifestCache = null
        this.manifestCacheTime = null
        this.manifestCacheTimeout = 5 * 60 * 1000 // 5 minutes en millisecondes
        
        // Limitation de bande passante
        this.maxDownloadSpeed = 20 * 1024 * 1024 // 5 MB/s en bytes par seconde
        this.downloadStartTime = null
        this.downloadedBytes = 0
        
        // Throttling pour les mises à jour de vitesse
        this.lastSpeedUpdate = 0
        this.speedUpdateInterval = 1000 // 1 seconde en millisecondes
        
        // Créer le dossier de jeu s'il n'existe pas
        if (!fs.existsSync(this.gameDirectory)) {
            fs.mkdirSync(this.gameDirectory, { recursive: true })
        }
        
        // Créer le fichier channel.inf au premier lancement
        this.createChannelInfIfNeeded()
    }

    /**
     * Réinitialise le throttling pour un nouveau fichier
     */
    resetThrottling() {
        this.lastSpeedUpdate = 0
    }

    /**
     * Crée le fichier channel.inf avec le contenu par défaut s'il n'existe pas ou s'il est vide
     */
    createChannelInfIfNeeded() {
        const channelInfPath = path.join(this.gameDirectory, 'channel.inf')
        
        // Vérifier si le fichier existe déjà
        if (!fs.existsSync(channelInfPath)) {
            try {
                // Créer le fichier avec le contenu par défaut
                fs.writeFileSync(channelInfPath, '1 99 0', 'utf8')
                console.log('Fichier channel.inf créé avec le contenu par défaut: 1 99 0')
            } catch (error) {
                console.error('Erreur lors de la création du fichier channel.inf:', error)
            }
        } else {
            // Le fichier existe, vérifier s'il est vide
            try {
                const content = fs.readFileSync(channelInfPath, 'utf8').trim()
                
                // Si le fichier est vide (pas de contenu), le remplir
                if (content === '') {
                    fs.writeFileSync(channelInfPath, '1 99 0', 'utf8')
                    console.log('Fichier channel.inf vide détecté, contenu par défaut ajouté: 1 99 0')
                } else {
                    console.log('Fichier channel.inf existe déjà avec du contenu:', content)
                }
            } catch (error) {
                console.error('Erreur lors de la vérification du fichier channel.inf:', error)
            }
        }
    }

    /**
     * Télécharge et parse le manifest.json avec cache
     */
    async fetchManifest(forceRefresh = false) {
        // Vérifier le cache si pas de refresh forcé
        if (!forceRefresh && this.isManifestCacheValid()) {
            console.log('Utilisation du manifest en cache')
            this.manifest = this.manifestCache
            return this.manifest
        }
        
        return new Promise((resolve, reject) => {
            console.log('Téléchargement du manifest...')
            https.get(MANIFEST_URL, (res) => {
                let data = ''
                
                res.on('data', (chunk) => {
                    data += chunk
                })
                
                res.on('end', () => {
                    try {
                        this.manifest = JSON.parse(data)
                        
                        // Mettre en cache
                        this.manifestCache = this.manifest
                        this.manifestCacheTime = Date.now()
                        
                        console.log(`Manifest chargé: ${this.manifest.files.length} fichiers`)
                        resolve(this.manifest)
                    } catch (error) {
                        reject(new Error(`Erreur parsing manifest: ${error.message}`))
                    }
                })
            }).on('error', (error) => {
                reject(new Error(`Erreur téléchargement manifest: ${error.message}`))
            })
        })
    }
    
    /**
     * Vérifie si le cache du manifest est encore valide
     */
    isManifestCacheValid() {
        if (!this.manifestCache || !this.manifestCacheTime) {
            return false
        }
        
        const now = Date.now()
        const cacheAge = now - this.manifestCacheTime
        
        if (cacheAge > this.manifestCacheTimeout) {
            console.log(`Cache du manifest expiré (${Math.round(cacheAge / 1000)}s)`)
            return false
        }
        
        console.log(`Cache du manifest valide (${Math.round(cacheAge / 1000)}s)`)
        return true
    }
    
    /**
     * Force le rechargement du manifest (ignore le cache)
     */
    async forceRefreshManifest() {
        console.log('Rechargement forcé du manifest...')
        return await this.fetchManifest(true)
    }
    
    /**
     * Contrôle la vitesse de téléchargement pour respecter la limite
     */
    async throttleDownload(chunkSize) {
        if (!this.downloadStartTime) {
            this.downloadStartTime = Date.now()
            this.downloadedBytes = 0
        }
        
        this.downloadedBytes += chunkSize
        const elapsedTime = (Date.now() - this.downloadStartTime) / 1000 // en secondes
        const currentSpeed = this.downloadedBytes / elapsedTime // bytes par seconde
        
        if (currentSpeed > this.maxDownloadSpeed) {
            // Calculer le délai nécessaire pour respecter la limite
            const targetTime = this.downloadedBytes / this.maxDownloadSpeed
            const delay = (targetTime - elapsedTime) * 1000 // en millisecondes
            
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }
    
    /**
     * Configure la limite de vitesse de téléchargement
     */
    setMaxDownloadSpeed(speedMBps) {
        this.maxDownloadSpeed = speedMBps * 1024 * 1024 // Convertir MB/s en bytes/s
        console.log(`Limite de vitesse configurée à ${speedMBps} MB/s`)
    }
    
    /**
     * Réinitialise le compteur de throttling pour un nouveau fichier
     */
    resetThrottling() {
        this.downloadStartTime = null
        this.downloadedBytes = 0
    }

    /**
     * Calcule le hash MD5 d'un fichier de manière asynchrone
     */
    async calculateFileHash(filePath) {
        if (!fs.existsSync(filePath)) {
            return null
        }
        
        return new Promise((resolve, reject) => {
            const hashSum = crypto.createHash('md5')
            const stream = fs.createReadStream(filePath)
            
            stream.on('data', (data) => {
                hashSum.update(data)
            })
            
            stream.on('end', () => {
                resolve(hashSum.digest('hex'))
            })
            
            stream.on('error', (error) => {
                reject(error)
            })
        })
    }

    /**
     * Vérifie tous les fichiers du manifest
     */
    async verifyFiles(onProgress) {
        if (!this.manifest) {
            throw new Error('Manifest non chargé')
        }

        this.filesToDownload = []
        console.log('Vérification des fichiers...')

        const totalFiles = this.manifest.files.length
        let processedFiles = 0

        for (const file of this.manifest.files) {
            const localPath = path.join(this.gameDirectory, file.path)
            const localHash = await this.calculateFileHash(localPath)
            
            if (localHash !== file.hash) {
                this.filesToDownload.push(file)
                console.log(`Fichier à télécharger: ${file.path} (hash: ${localHash} vs ${file.hash})`)
            }
            
            processedFiles++
            
            // Mettre à jour le progrès si un callback est fourni
            if (onProgress) {
                const progress = Math.round((processedFiles / totalFiles) * 100)
                onProgress(progress, file.path, processedFiles, totalFiles)
            }
            
            // Petite pause pour permettre à l'interface de se mettre à jour
            if (processedFiles % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1))
            }
        }

        this.totalFiles = this.filesToDownload.length
        console.log(`${this.totalFiles} fichiers à télécharger`)
        
        return this.filesToDownload.length === 0
    }

    /**
     * Télécharge un fichier
     */
    downloadFile(file, onProgress) {
        return new Promise((resolve, reject) => {
            const fileUrl = FILES_BASE_URL + file.path
            const localPath = path.join(this.gameDirectory, file.path)
            
            // Créer le dossier parent si nécessaire
            const dir = path.dirname(localPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }

            console.log(`Téléchargement: ${file.path}`)
            
            https.get(fileUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Erreur HTTP ${res.statusCode} pour ${file.path}`))
                    return
                }

                const fileStream = fs.createWriteStream(localPath)
                let downloadedBytes = 0
                const totalBytes = parseInt(res.headers['content-length'] || '0')
                
                // Variables pour calculer la vitesse
                let startTime = Date.now()
                let lastBytes = 0
                let lastTime = startTime

                res.on('data', async (chunk) => {
                    // Appliquer le throttling pour respecter la limite de vitesse
                    await this.throttleDownload(chunk.length)
                    
                    downloadedBytes += chunk.length
                    
                    if (onProgress && totalBytes > 0) {
                        const progress = (downloadedBytes / totalBytes) * 100
                        
                        // Calculer la vitesse de téléchargement avec throttling
                        const currentTime = Date.now()
                        const timeDiff = (currentTime - startTime) / 1000 // temps total depuis le début
                        
                        let speedMBps = null
                        // Vérifier si on doit mettre à jour la vitesse (throttling à 1 seconde)
                        if (timeDiff > 0.5 && (currentTime - this.lastSpeedUpdate) >= this.speedUpdateInterval) {
                            speedMBps = (downloadedBytes / (1024 * 1024)) / timeDiff
                            this.lastSpeedUpdate = currentTime
                            console.log(`Vitesse: ${speedMBps.toFixed(2)} MB/s (limite: 20 MB/s)`)
                        }
                        
                        onProgress(progress, file.path, speedMBps)
                    }
                })

                res.pipe(fileStream)

                fileStream.on('finish', async () => {
                    fileStream.close()
                    // Vérifier le hash du fichier téléchargé
                    try {
                        const downloadedHash = await this.calculateFileHash(localPath)
                        if (downloadedHash === file.hash) {
                            console.log(`✓ ${file.path} téléchargé et vérifié`)
                            resolve()
                        } else {
                            reject(new Error(`Hash incorrect pour ${file.path}`))
                        }
                    } catch (error) {
                        reject(new Error(`Erreur lors de la vérification du hash pour ${file.path}: ${error.message}`))
                    }
                })

                fileStream.on('error', (error) => {
                    reject(error)
                })
            }).on('error', (error) => {
                reject(error)
            })
        })
    }

    /**
     * Télécharge tous les fichiers manquants
     */
    async downloadAllFiles(onProgress) {
        if (this.filesToDownload.length === 0) {
            return true
        }

        this.currentFileIndex = 0
        
        for (const file of this.filesToDownload) {
            try {
                // Réinitialiser le throttling pour chaque nouveau fichier
                this.resetThrottling()
                
                await this.downloadFile(file, (fileProgress, fileName, speedMBps) => {
                    const overallProgress = ((this.currentFileIndex / this.totalFiles) * 100) + 
                                          (fileProgress / this.totalFiles)
                    
                    if (onProgress) {
                        onProgress(Math.round(overallProgress), fileName, this.currentFileIndex + 1, this.totalFiles, speedMBps)
                    }
                })
                
                this.currentFileIndex++
            } catch (error) {
                console.error(`Erreur téléchargement ${file.path}:`, error)
                throw error
            }
        }

        return true
    }

    /**
     * Processus complet de vérification et mise à jour
     */
    async checkAndUpdate(onProgress, onStatusChange, forceRefreshManifest = false) {
        try {
            // Vérifier si on peut utiliser le cache
            if (this.isManifestCacheValid() && !forceRefreshManifest) {
                if (onStatusChange) onStatusChange('Vérification des fichiers...')
                console.log('Manifest en cache, passage direct à la vérification')
            } else {
                if (onStatusChange) onStatusChange('Téléchargement du manifest...')
                await this.fetchManifest(forceRefreshManifest)
            }
            
            if (onStatusChange) onStatusChange('Vérification des fichiers...')
            const isUpToDate = await this.verifyFiles(onProgress)
            
            if (isUpToDate) {
                if (onStatusChange) onStatusChange('À jour')
                if (onProgress) onProgress(100)
                return true
            }
            
            if (onStatusChange) onStatusChange(`Téléchargement de ${this.totalFiles} fichiers...`)
            await this.downloadAllFiles(onProgress)
            
            if (onStatusChange) onStatusChange('À jour')
            return true
            
        } catch (error) {
            console.error('Erreur patcher:', error)
            if (onStatusChange) onStatusChange(`Erreur: ${error.message}`)
            throw error
        }
    }
}

// Fonction utilitaire pour configurer la limite de vitesse globalement
AscendPatcher.setGlobalMaxSpeed = function(speedMBps) {
    console.log(`Configuration globale de la limite de vitesse à ${speedMBps} MB/s`)
    // Cette fonction peut être utilisée pour configurer la limite par défaut
    return speedMBps
}

module.exports = AscendPatcher





