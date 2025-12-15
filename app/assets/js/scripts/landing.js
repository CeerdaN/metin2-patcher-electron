/**
 * Script for landing.ejs
 */

// ============================================================================
// CONFIGURATION - UPDATE THIS FOR YOUR SERVER
// ============================================================================
// This must match GAME_FOLDER_NAME in app/assets/js/ascendpatcher.js
const GAME_FOLDER_NAME = 'YourServerName'  // Game folder in Documents/ directory
const RSS_FEED_URL = 'https://yoursite.com/news.rss'  // Your RSS news feed
const API_URL = 'https://yoursite.com/launcher-api.php'  // Your auth API endpoint
const API_KEY = 'your_secure_api_key'  // Your API key
// ============================================================================

// Requirements
const { URL }                 = require('url')
const {
    MojangRestAPI,
    getServerStatus
}                             = require('helios-core/mojang')
const {
    RestResponseStatus,
    isDisplayableError,
    validateLocalFile
}                             = require('helios-core/common')
const {
    FullRepair,
    DistributionIndexProcessor,
    MojangIndexProcessor,
    downloadFile
}                             = require('helios-core/dl')
const {
    validateSelectedJvm,
    ensureJavaDirIsRoot,
    javaExecFromRoot,
    discoverBestJvmInstallation,
    latestOpenJDK,
    extractJdk
}                             = require('helios-core/java')

// Internal Requirements
const DiscordWrapper          = require('./assets/js/discordwrapper')
const ProcessBuilder          = require('./assets/js/processbuilder')
const AscendPatcher           = require('./assets/js/ascendpatcher')

// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launch_progress')
const launch_progress_label   = document.getElementById('launch_progress_label')
const launch_details_text     = document.getElementById('launch_details_text')
const server_selection_button = document.getElementById('server_selection_button')
const user_text               = document.getElementById('user_text')

const loggerLanding = LoggerUtil.getLogger('Landing')

/* Launch Progress Wrapper Functions */

/**
 * Show/hide the loading area.
 * 
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading){
    if(loading){
        launch_details.style.display = 'flex'
        launch_content.style.display = 'none'
    } else {
        launch_details.style.display = 'none'
        launch_content.style.display = 'inline-flex'
    }
}

/**
 * Set the details text of the loading area.
 * 
 * @param {string} details The new text for the loading details.
 */
function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

/**
 * Set the value of the loading progress bar and display that value.
 * 
 * @param {number} percent Percentage (0-100)
 */
function setLaunchPercentage(percent){
    launch_progress.setAttribute('max', 100)
    launch_progress.setAttribute('value', percent)
    launch_progress_label.innerHTML = percent + '%'
}

/**
 * Set the value of the OS progress bar and display that on the UI.
 * 
 * @param {number} percent Percentage (0-100)
 */
function setDownloadPercentage(percent){
    remote.getCurrentWindow().setProgressBar(percent/100)
    setLaunchPercentage(percent)
}

/**
 * Enable or disable the launch button.
 * 
 * @param {boolean} val True to enable, false to disable.
 */
function setLaunchEnabled(val){
    document.getElementById('launch_button').disabled = !val
}

// Instance globale du patcher pour réutiliser le cache
let globalPatcher = null

/**
 * Affiche les informations du cache du manifest
 */
function showManifestCacheInfo() {
    if (!globalPatcher) {
        console.log('Aucun patcher global initialisé')
        return
    }
    
    if (globalPatcher.isManifestCacheValid()) {
        const cacheAge = Math.round((Date.now() - globalPatcher.manifestCacheTime) / 1000)
        console.log(`Cache du manifest valide (${cacheAge}s) - ${globalPatcher.manifest?.files?.length || 0} fichiers`)
    } else {
        console.log('Cache du manifest invalide ou expiré')
    }
}

// Exporter pour le débogage
window.showManifestCacheInfo = showManifestCacheInfo

/*******************************************************************************
 *                                                                             *
 * Version Management System                                                  *
 *                                                                             *
 ******************************************************************************/

/**
 * Vérifie si la version du jeu est à jour
 */
async function checkGameVersion() {
    try {
        const { app } = require('@electron/remote');
        const path = require('path');
        const fs = require('fs');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const versionFile = path.join(gameDirectory, 'version.txt');
        
        // Récupérer la version du manifest
        if (!globalPatcher) {
            globalPatcher = new AscendPatcher();
        }
        
        const manifest = await globalPatcher.fetchManifest();
        const manifestVersion = manifest.version || '1.0.0';
        
        // Vérifier si version.txt existe
        let currentVersion = null;
        if (fs.existsSync(versionFile)) {
            currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
        }
        
        console.log(`Version manifest: ${manifestVersion}, Version locale: ${currentVersion || 'inexistante'}`);
        
        // Si pas de version.txt ou version différente, il faut vérifier
        if (!currentVersion || currentVersion !== manifestVersion) {
            return {
                isUpToDate: false,
                manifestVersion: manifestVersion,
                currentVersion: currentVersion
            };
        }
        
        // Version identique, pas besoin de vérifier les fichiers
        console.log('Version identique, lancement direct du jeu');
        return {
            isUpToDate: true,
            manifestVersion: manifestVersion,
            currentVersion: currentVersion
        };
        
    } catch (error) {
        console.error('Erreur lors de la vérification de version:', error);
        return {
            isUpToDate: false,
            manifestVersion: '1.0.0',
            currentVersion: null,
            error: error.message
        };
    }
}

/**
 * Met à jour le fichier version.txt avec la nouvelle version
 */
function updateVersionFile(version) {
    try {
        const { app } = require('@electron/remote');
        const path = require('path');
        const fs = require('fs');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const versionFile = path.join(gameDirectory, 'version.txt');

        fs.writeFileSync(versionFile, version);
        console.log(`Version mise à jour: ${version}`);
        
    } catch (error) {
        console.error('Erreur lors de la mise à jour de version:', error);
    }
}

// Bind launch button for Metin2 Game patcher
document.getElementById('launch_button').addEventListener('click', async e => {
    loggerLanding.info('Starting Metin2 Game game...')
    
    try {
            toggleLaunchArea(true)
        setLaunchPercentage(0)
        
        // Réutiliser l'instance existante ou en créer une nouvelle
        if (!globalPatcher) {
            globalPatcher = new AscendPatcher()
        }
        const patcher = globalPatcher
        
        // Vérifier d'abord la version
        setLaunchDetails('Vérification de la version...')
        const versionCheck = await checkGameVersion()
        
        if (versionCheck.isUpToDate) {
            // Version à jour, lancer directement
            setLaunchDetails('Version à jour, lancement du jeu...')
            setLaunchPercentage(100)
            
            setTimeout(() => {
                launchAscend2Game()
                setTimeout(() => {
                    setLaunchDetails('YourServerName lancé avec succès')
                }, 2000)
            }, 500)
        } else {
            // Version pas à jour, faire la mise à jour complète
            setLaunchDetails(`Mise à jour vers la version ${versionCheck.manifestVersion}...`)
            
            // Vérifier rapidement si on peut utiliser le cache
            if (patcher.isManifestCacheValid()) {
                console.log('Manifest en cache, vérification rapide...')
                setLaunchDetails('Vérification des fichiers...')
            } else {
                console.log('Manifest pas en cache, téléchargement...')
                setLaunchDetails('Téléchargement du manifest...')
                await patcher.fetchManifest()
            }
            
            // Vérifier les fichiers
            setLaunchDetails('Vérification des fichiers...')
            const isUpToDate = await patcher.verifyFiles((progress, fileName, currentFile, totalFiles) => {
                setLaunchPercentage(Math.min(Math.max(progress, 0), 100))
                if (fileName) {
                    setLaunchDetails(`Vérification: ${fileName} (${currentFile}/${totalFiles})`)
                }
            })
            
            if (!isUpToDate) {
                // Fichiers pas à jour, faire la mise à jour
                setLaunchDetails(`Téléchargement de ${patcher.totalFiles} fichiers...`)
                
                await patcher.downloadAllFiles((progress, fileName, currentFile, totalFiles, speedMBps) => {
                const limitedProgress = Math.min(Math.max(progress, 0), 100)
                setLaunchPercentage(limitedProgress)
                if (fileName) {
                    let speedText = ''
                    if (speedMBps !== null && speedMBps > 0) {
                        speedText = ` (${speedMBps.toFixed(1)} MB/s)`
                    }
                        setLaunchDetails(`Téléchargement: ${fileName} (${currentFile}/${totalFiles})${speedText}`)
                    }
                })
            }
            
            // Mettre à jour le fichier version.txt
            updateVersionFile(versionCheck.manifestVersion)
            
            // Une fois la mise à jour terminée, lancer le jeu
            setLaunchDetails('Mise à jour terminée, lancement du jeu...')
            setLaunchPercentage(100)
            
        setTimeout(() => {
            launchAscend2Game()
            setTimeout(() => {
                setLaunchDetails('YourServerName lancé avec succès')
                }, 2000)
        }, 1000)
        }
        
    } catch(err) {
        loggerLanding.error('Erreur lancement Metin2 Game:', err)
        showLaunchFailure('Erreur Lancement', `Impossible de lancer le jeu: ${err.message}`)
    }
})

// Bind settings button
document.getElementById('settingsMediaButton').onclick = async e => {
    console.log('Bouton settings cliqué')
    try {
        // Version simplifiée pour tester
        console.log('Ouverture directe des paramètres...')
        $('#landingContainer').fadeOut(500)
        $('#settingsContainer').fadeIn(500)
        console.log('Paramètres ouverts (version simple)')
        
        // Initialiser la navigation des settings après ouverture
        initializeSettingsNavigation()
        
        // Initialiser directement l'import des comptes
        initializeAccountImportSimple()
    } catch (error) {
        console.error('Erreur lors de l\'ouverture des paramètres:', error)
    }
}

// Fonction pour initialiser la navigation des settings
function initializeSettingsNavigation() {
    console.log('Initialisation de la navigation des settings')
    
    // Gérer les clics sur les boutons de navigation
    $('.settingsNavItem').off('click').on('click', function(e) {
        e.preventDefault()
        console.log('Clic sur:', $(this).text())
        
        const targetTab = $(this).attr('rSc')
        console.log('Onglet cible:', targetTab)
        
        if (targetTab) {
            // Vérifier si l'onglet existe
            const tabElement = $('#' + targetTab)
            console.log('Élément onglet trouvé:', tabElement.length)
            
            if (tabElement.length > 0) {
                // Masquer tous les onglets
                $('.settingsTab').hide()
                console.log('Tous les onglets masqués')
                
                // Désélectionner tous les boutons
                $('.settingsNavItem').removeAttr('selected').removeClass('selected')
                
                // Afficher l'onglet cible
                tabElement.show()
                console.log('Onglet affiché:', targetTab)
                
                // Sélectionner le bouton
                $(this).attr('selected', '').addClass('selected')
                console.log('Bouton sélectionné')
                
                // Initialiser les paramètres Metin2 si on bascule vers cet onglet
                if (targetTab === 'settingsTabMetin2') {
                    console.log('Initialisation des paramètres Metin2...')
                    setTimeout(() => {
                        if (typeof window.initializeMetin2Settings === 'function') {
                            window.initializeMetin2Settings()
                            //window.initializeMetin2SettingsGraphics()
                        } else {
                            console.error('initializeMetin2Settings non trouvée')
                        }
                    }, 200)
                }
            } else {
                console.error('Onglet non trouvé:', targetTab)
            }
        } else {
            console.log('Pas d\'onglet cible défini')
        }
    })
    
    // Gérer le bouton Done
    $('#settingsNavDone').off('click').on('click', function(e) {
        e.preventDefault()
        console.log('Fermeture des paramètres')
        $('#settingsContainer').fadeOut(500)
        $('#landingContainer').fadeIn(500)
    })
}

// Fonction simplifiée pour l'import des comptes
function initializeAccountImportSimple() {
    console.log('Initialisation simple de l\'import des comptes...')
    
    const importButton = document.getElementById('settingsImportAccountsButton')
    const modal = document.getElementById('importAccountsModal')
    const closeButton = document.getElementById('importAccountsModalClose')
    const cancelButton = document.getElementById('importAccountsCancel')
    const confirmButton = document.getElementById('importAccountsConfirm')
    const folderPathInput = document.getElementById('importAccountsFolderPath')
    const browseButton = document.getElementById('selectImportFolderButton')
    
    if (!importButton || !modal || !browseButton) {
        console.error('Éléments non trouvés:', {
            importButton: !!importButton,
            modal: !!modal,
            browseButton: !!browseButton
        })
        return
    }
    
    console.log('Éléments trouvés, initialisation des événements...')
    
    // Ouvrir la modal
    importButton.onclick = function() {
        console.log('Ouverture de la modal d\'import')
        modal.style.display = 'flex'
    }
    
    // Fermer la modal
    closeButton.onclick = function() {
        modal.style.display = 'none'
    }
    
    cancelButton.onclick = function() {
        modal.style.display = 'none'
    }
    
    // Fermer en cliquant à l'extérieur
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.style.display = 'none'
        }
    }
    
    // Sélectionner un dossier
    browseButton.onclick = async function() {
        console.log('Sélection de dossier...')
        
        try {
            const { dialog } = require('@electron/remote')
            const fs = require('fs')
            const path = require('path')
            
            console.log('Modules Electron chargés')
            
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Sélectionner le dossier contenant les comptes (UserData)'
            })
            
            if (!result.canceled && result.filePaths.length > 0) {
                const folderPath = result.filePaths[0]
                const accountDataPath = path.join(folderPath, 'account_data.inf')
                
                console.log('Dossier sélectionné:', folderPath)
                console.log('Vérification du fichier account_data.inf...')
                
                // Vérifier si le fichier account_data.inf existe
                if (fs.existsSync(accountDataPath)) {
                    console.log('Fichier account_data.inf trouvé !')
                    folderPathInput.value = folderPath
                    confirmButton.disabled = false
                    
                    // Afficher un message de confirmation
                    const statusDiv = document.getElementById('importAccountsStatus')
                    if (statusDiv) {
                        statusDiv.style.display = 'block'
                        statusDiv.innerHTML = '✅ Fichier account_data.inf trouvé dans le dossier sélectionné'
                        statusDiv.style.color = '#4CAF50'
                    }
                } else {
                    console.log('Fichier account_data.inf non trouvé')
                    folderPathInput.value = ''
                    confirmButton.disabled = true
                    
                    // Afficher un message d'erreur
                    const statusDiv = document.getElementById('importAccountsStatus')
                    if (statusDiv) {
                        statusDiv.style.display = 'block'
                        statusDiv.innerHTML = '❌ Fichier account_data.inf non trouvé dans ce dossier'
                        statusDiv.style.color = '#f44336'
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors de la sélection du dossier:', error)
            alert('Erreur: ' + error.message)
        }
    }
    
    // Confirmer l'import
    confirmButton.onclick = function() {
        console.log('Import confirmé')
        const folderPath = folderPathInput.value
        
        if (folderPath) {
            try {
                const fs = require('fs')
                const path = require('path')
                
                const sourceFile = path.join(folderPath, 'account_data.inf')
                // Utiliser le même chemin que le jeu (Documents/Ascend2/data)
                const { app } = require('@electron/remote')
                const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME)
                const targetDir = path.join(gameDirectory, 'UserData')
                const targetFile = path.join(targetDir, 'account_data.inf')
                
                console.log('Source:', sourceFile)
                console.log('Cible:', targetFile)
                
                // Créer le dossier data s'il n'existe pas
                if (!fs.existsSync(targetDir)) {
                    console.log('Création du dossier data...')
                    fs.mkdirSync(targetDir, { recursive: true })
                }
                
                // Copier le fichier (remplace s'il existe déjà)
                console.log('Copie du fichier account_data.inf...')
                fs.copyFileSync(sourceFile, targetFile)
                
                console.log('Import réussi !')
                
                // Afficher un message de succès
                const statusDiv = document.getElementById('importAccountsStatus')
                if (statusDiv) {
                    statusDiv.style.display = 'block'
                    statusDiv.innerHTML = 'Import réussi !'
                    statusDiv.style.color = '#4CAF50'
                }
                
                // Fermer la modal après un délai
                setTimeout(() => {
                    modal.style.display = 'none'
                    // Réinitialiser le formulaire
                    folderPathInput.value = ''
                    confirmButton.disabled = true
                    if (statusDiv) {
                        statusDiv.style.display = 'none'
                    }
                }, 2000)
                
            } catch (error) {
                console.error('Erreur lors de l\'import:', error)
                
                // Afficher un message d'erreur
                const statusDiv = document.getElementById('importAccountsStatus')
                if (statusDiv) {
                    statusDiv.style.display = 'block'
                    statusDiv.innerHTML = '❌ Erreur lors de l\'import: ' + error.message
                    statusDiv.style.color = '#f44336'
                }
            }
        }
    }
    
    console.log('Initialisation de l\'import terminée')
}

// Avatar overlay button removed for patcher mode

/**
 * Lance le jeu Metin2 Game
 */
function launchAscend2Game() {
    // Vérifier si la configuration du jeu doit être affichée
    if (checkGameConfigBeforeLaunch()) {
        console.log('Configuration du jeu requise avant le lancement');
        return; // Arrêter ici, la configuration va lancer le jeu
    }
    
    const { spawn } = require('child_process')
    const path = require('path')
    const { app } = require('@electron/remote')
    
    const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME)
    const gameExecutable = path.join(gameDirectory, 'metin2client.exe')
    
    try {
        loggerLanding.info('Lancement d\'Metin2 Game...')
        
        // Vérifier si l'exécutable existe
        const fs = require('fs')
        if (!fs.existsSync(gameExecutable)) {
            throw new Error('metin2client.exe introuvable')
        }
        
        // Lancer le jeu
        const gameProcess = spawn(gameExecutable, [], {
            cwd: gameDirectory,
            detached: true,
            stdio: 'ignore'
        })
        
        gameProcess.unref()
        
        // Fermer le patcheur après le lancement
        setTimeout(() => {
            setLaunchDetails('Metin2 Game lancé avec succès!')
            toggleLaunchArea(false)
            
            // Optionnel: fermer le launcher
            // require('@electron/remote').getCurrentWindow().close()
        }, 20000)
        
    } catch (error) {
        loggerLanding.error('Erreur lancement Metin2 Game:', error)
        showLaunchFailure('Erreur de Lancement', `Impossible de lancer Metin2 Game: ${error.message}`)
    }
}

// Bind selected account - Removed authentication requirement for patcher
function updateSelectedAccount(authUser){
    let username = 'YourServerName'  // Nom fixe pour le patcheur
    user_text.innerHTML = username
}
updateSelectedAccount(null)

/**
 * Met à jour le statut du patcheur dans l'interface
 */
function updatePatcherStatus(status, isUpToDate = false) {
    const statusElement = document.getElementById('player_count')
    const iconElement = document.getElementById('mojang_status_icon')
    
    if (statusElement) {
        statusElement.innerHTML = status
    }
    
    if (iconElement) {
        if (isUpToDate) {
            iconElement.style.color = '#4CAF50' // Vert pour "à jour"
        } else if (status.includes('Téléchargement') || status.includes('Vérification') || status.includes('%')) {
            iconElement.style.color = '#FF9800' // Orange pour téléchargement
        } else if (status.includes('Erreur')) {
            iconElement.style.color = '#F44336' // Rouge pour erreur
        } else {
            iconElement.style.color = '#2196F3' // Bleu pour vérification
        }
    }
}

/**
 * Vérifie automatiquement le statut des fichiers au démarrage
 */
async function checkPatcherStatusOnStartup() {
    try {
        updatePatcherStatus('Vérif...')
        
        // Créer l'instance globale au démarrage
        if (!globalPatcher) {
            globalPatcher = new AscendPatcher()
        }
        const patcher = globalPatcher
        
        // Au démarrage, on charge toujours le manifest (pas de cache)
        await patcher.fetchManifest()
        const isUpToDate = await patcher.verifyFiles()
        
        if (isUpToDate) {
            updatePatcherStatus('À jour', true)
        } else {
            updatePatcherStatus(`${patcher.totalFiles} MAJ`)
        }
        
    } catch (error) {
        console.error('Erreur vérification patcheur:', error)
        updatePatcherStatus('Erreur')
    }
}

// Lancer la vérification au démarrage
setTimeout(() => {
    checkPatcherStatusOnStartup()
}, 500)

// Bind selected server - Simplified for patcher mode
function updateSelectedServer(serv){
    if(getCurrentView() === VIEWS.settings){
        fullSettingsSave()
    }
    // Le bouton garde sa fonction de vérification des fichiers
    // ConfigManager.setSelectedServer(serv != null ? serv.rawServer.id : null)
    // ConfigManager.save()
    if(getCurrentView() === VIEWS.settings){
        animateSettingsTabRefresh()
    }
    setLaunchEnabled(true) // Toujours actif pour le patcheur
}
// Transformer le bouton en bouton de vérification des fichiers
server_selection_button.innerHTML = '&#8226; Vérifier les fichiers'
server_selection_button.onclick = async e => {
    e.target.blur()
    await checkAndUpdateFiles()
}

// Ajouter un double-clic pour forcer le refresh du manifest
server_selection_button.ondblclick = async e => {
    e.target.blur()
    console.log('Double-clic détecté - Refresh forcé du manifest')
    await checkAndUpdateFiles(true)
}

/**
 * Fonction pour vérifier et mettre à jour les fichiers via le bouton
 */
async function checkAndUpdateFiles(forceRefresh = false) {
    try {
        // Désactiver les boutons pendant la vérification
        server_selection_button.disabled = true
        document.getElementById('launch_button').disabled = true
        server_selection_button.innerHTML = forceRefresh ? '&#8226; Refresh...' : '&#8226; Vérification...'
        
        // Réutiliser l'instance globale ou en créer une nouvelle
        if (!globalPatcher) {
            globalPatcher = new AscendPatcher()
        }
        const patcher = globalPatcher
        
        // Vérifier les fichiers (utilise le cache sauf si forceRefresh)
        await patcher.fetchManifest(forceRefresh)
        const isUpToDate = await patcher.verifyFiles((progress, fileName, currentFile, totalFiles) => {
            // Mettre à jour le bouton avec le progrès de vérification
            server_selection_button.innerHTML = `&#8226; Vérification... ${Math.round(progress)}% (${currentFile}/${totalFiles})`
        })
        
        if (isUpToDate) {
            server_selection_button.innerHTML = '&#8226; À jour'
            updatePatcherStatus('À jour', true)
            
            // Remettre le texte original après 3 secondes
            setTimeout(() => {
                server_selection_button.innerHTML = '&#8226; Vérifier les fichiers'
                server_selection_button.disabled = false
                document.getElementById('launch_button').disabled = false
            }, 3000)
            
        } else {
            // Lancer les téléchargements
            server_selection_button.innerHTML = `&#8226; ${patcher.totalFiles} MAJ en cours...`
            
            await patcher.downloadAllFiles(
                (progress, fileName, currentFile, totalFiles, speedMBps) => {
                    // Mettre à jour le bouton avec le progrès et la vitesse
                    let speedText = ''
                    if (speedMBps !== null && speedMBps > 0) {
                        speedText = `${speedMBps.toFixed(1)} MB/s | `
                    }
                    server_selection_button.innerHTML = `&#8226; ${speedText}${Math.round(progress)}% (${currentFile}/${totalFiles})`
                    updatePatcherStatus(`${speedText}${Math.round(progress)}%`)
                }
            )
            
            // Terminé
            server_selection_button.innerHTML = '&#8226; Mise à jour terminée'
            updatePatcherStatus('À jour', true)
            
            // Remettre le texte original après 3 secondes
            setTimeout(() => {
                server_selection_button.innerHTML = '&#8226; Vérifier les fichiers'
                server_selection_button.disabled = false
                document.getElementById('launch_button').disabled = false
            }, 3000)
        }
        
    } catch (error) {
        console.error('Erreur vérification fichiers:', error)
        server_selection_button.innerHTML = '&#8226; Erreur'
        updatePatcherStatus('Erreur')
        
        // Remettre le texte original après 3 secondes
        setTimeout(() => {
            server_selection_button.innerHTML = '&#8226; Vérifier les fichiers'
            server_selection_button.disabled = false
            document.getElementById('launch_button').disabled = false
        }, 3000)
    }
}

// Update Mojang Status Color
const refreshMojangStatuses = async function(){
    loggerLanding.info('Refreshing Mojang Statuses..')

    let status = 'grey'
    let tooltipEssentialHTML = ''
    let tooltipNonEssentialHTML = ''

    const response = await MojangRestAPI.status()
    let statuses
    if(response.responseStatus === RestResponseStatus.SUCCESS) {
        statuses = response.data
    } else {
        loggerLanding.warn('Unable to refresh Mojang service status.')
        statuses = MojangRestAPI.getDefaultStatuses()
    }
    
    greenCount = 0
    greyCount = 0

    for(let i=0; i<statuses.length; i++){
        const service = statuses[i]

        const tooltipHTML = `<div class="mojangStatusContainer">
            <span class="mojangStatusIcon" style="color: ${MojangRestAPI.statusToHex(service.status)};">&#8226;</span>
            <span class="mojangStatusName">${service.name}</span>
        </div>`
        if(service.essential){
            tooltipEssentialHTML += tooltipHTML
        } else {
            tooltipNonEssentialHTML += tooltipHTML
        }

        if(service.status === 'yellow' && status !== 'red'){
            status = 'yellow'
        } else if(service.status === 'red'){
            status = 'red'
        } else {
            if(service.status === 'grey'){
                ++greyCount
            }
            ++greenCount
        }

    }

    if(greenCount === statuses.length){
        if(greyCount === statuses.length){
            status = 'grey'
        } else {
            status = 'green'
        }
    }
    
    document.getElementById('mojangStatusEssentialContainer').innerHTML = tooltipEssentialHTML
    document.getElementById('mojangStatusNonEssentialContainer').innerHTML = tooltipNonEssentialHTML
    document.getElementById('mojang_status_icon').style.color = MojangRestAPI.statusToHex(status)
}

const refreshServerStatus = async (fade = false) => {
    loggerLanding.info('Refreshing Server Status')
    const serv = (await DistroAPI.getDistribution()).getServerById(ConfigManager.getSelectedServer())

    let pLabel = Lang.queryJS('landing.serverStatus.server')
    let pVal = Lang.queryJS('landing.serverStatus.offline')

    try {

        const servStat = await getServerStatus(47, serv.hostname, serv.port)
        console.log(servStat)
        pLabel = Lang.queryJS('landing.serverStatus.players')
        pVal = servStat.players.online + '/' + servStat.players.max

    } catch (err) {
        loggerLanding.warn('Unable to refresh server status, assuming offline.')
        loggerLanding.debug(err)
    }
    if(fade){
        $('#server_status_wrapper').fadeOut(250, () => {
            document.getElementById('landingPlayerLabel').innerHTML = pLabel
            document.getElementById('player_count').innerHTML = pVal
            $('#server_status_wrapper').fadeIn(500)
        })
    } else {
        document.getElementById('landingPlayerLabel').innerHTML = pLabel
        document.getElementById('player_count').innerHTML = pVal
    }
    
}

refreshMojangStatuses()
// Server Status is refreshed in uibinder.js on distributionIndexDone.

// Refresh statuses every hour. The status page itself refreshes every day so...
let mojangStatusListener = setInterval(() => refreshMojangStatuses(true), 60*60*1000)
// Set refresh rate to once every 5 minutes.
let serverStatusListener = setInterval(() => refreshServerStatus(true), 300000)

/**
 * Shows an error overlay, toggles off the launch area.
 * 
 * @param {string} title The overlay title.
 * @param {string} desc The overlay description.
 */
function showLaunchFailure(title, desc){
    setOverlayContent(
        title,
        desc,
        Lang.queryJS('landing.launch.okay')
    )
    setOverlayHandler(null)
    toggleOverlay(true)
    toggleLaunchArea(false)
}

/* System (Java) Scan */

/**
 * Asynchronously scan the system for valid Java installations.
 * 
 * @param {boolean} launchAfter Whether we should begin to launch after scanning. 
 */
async function asyncSystemScan(effectiveJavaOptions, launchAfter = true){

    setLaunchDetails(Lang.queryJS('landing.systemScan.checking'))
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    const jvmDetails = await discoverBestJvmInstallation(
        ConfigManager.getDataDirectory(),
        effectiveJavaOptions.supported
    )

    if(jvmDetails == null) {
        // If the result is null, no valid Java installation was found.
        // Show this information to the user.
        setOverlayContent(
            Lang.queryJS('landing.systemScan.noCompatibleJava'),
            Lang.queryJS('landing.systemScan.installJavaMessage', { 'major': effectiveJavaOptions.suggestedMajor }),
            Lang.queryJS('landing.systemScan.installJava'),
            Lang.queryJS('landing.systemScan.installJavaManually')
        )
        setOverlayHandler(() => {
            setLaunchDetails(Lang.queryJS('landing.systemScan.javaDownloadPrepare'))
            toggleOverlay(false)
            
            try {
                downloadJava(effectiveJavaOptions, launchAfter)
            } catch(err) {
                loggerLanding.error('Unhandled error in Java Download', err)
                showLaunchFailure(Lang.queryJS('landing.systemScan.javaDownloadFailureTitle'), Lang.queryJS('landing.systemScan.javaDownloadFailureText'))
            }
        })
        setDismissHandler(() => {
            $('#overlayContent').fadeOut(250, () => {
                //$('#overlayDismiss').toggle(false)
                setOverlayContent(
                    Lang.queryJS('landing.systemScan.javaRequired', { 'major': effectiveJavaOptions.suggestedMajor }),
                    Lang.queryJS('landing.systemScan.javaRequiredMessage', { 'major': effectiveJavaOptions.suggestedMajor }),
                    Lang.queryJS('landing.systemScan.javaRequiredDismiss'),
                    Lang.queryJS('landing.systemScan.javaRequiredCancel')
                )
                setOverlayHandler(() => {
                    toggleLaunchArea(false)
                    toggleOverlay(false)
                })
                setDismissHandler(() => {
                    toggleOverlay(false, true)

                    asyncSystemScan(effectiveJavaOptions, launchAfter)
                })
                $('#overlayContent').fadeIn(250)
            })
        })
        toggleOverlay(true, true)
    } else {
        // Java installation found, use this to launch the game.
        const javaExec = javaExecFromRoot(jvmDetails.path)
        ConfigManager.setJavaExecutable(ConfigManager.getSelectedServer(), javaExec)
        ConfigManager.save()

        // We need to make sure that the updated value is on the settings UI.
        // Just incase the settings UI is already open.
        settingsJavaExecVal.value = javaExec
        await populateJavaExecDetails(settingsJavaExecVal.value)

        // TODO Callback hell, refactor
        // TODO Move this out, separate concerns.
        if(launchAfter){
            await dlAsync()
        }
    }

}

async function downloadJava(effectiveJavaOptions, launchAfter = true) {

    // TODO Error handling.
    // asset can be null.
    const asset = await latestOpenJDK(
        effectiveJavaOptions.suggestedMajor,
        ConfigManager.getDataDirectory(),
        effectiveJavaOptions.distribution)

    if(asset == null) {
        throw new Error(Lang.queryJS('landing.downloadJava.findJdkFailure'))
    }

    let received = 0
    await downloadFile(asset.url, asset.path, ({ transferred }) => {
        received = transferred
        const percent = Math.trunc((transferred/asset.size)*100)
        const limitedPercent = Math.min(Math.max(percent, 0), 100)
        setDownloadPercentage(limitedPercent)
    })
    setDownloadPercentage(100)

    if(received != asset.size) {
        loggerLanding.warn(`Java Download: Expected ${asset.size} bytes but received ${received}`)
        if(!await validateLocalFile(asset.path, asset.algo, asset.hash)) {
            log.error(`Hashes do not match, ${asset.id} may be corrupted.`)
            // Don't know how this could happen, but report it.
            throw new Error(Lang.queryJS('landing.downloadJava.javaDownloadCorruptedError'))
        }
    }

    // Extract
    // Show installing progress bar.
    remote.getCurrentWindow().setProgressBar(2)

    // Wait for extration to complete.
    const eLStr = Lang.queryJS('landing.downloadJava.extractingJava')
    let dotStr = ''
    setLaunchDetails(eLStr)
    const extractListener = setInterval(() => {
        if(dotStr.length >= 3){
            dotStr = ''
        } else {
            dotStr += '.'
        }
        setLaunchDetails(eLStr + dotStr)
    }, 750)

    const newJavaExec = await extractJdk(asset.path)

    // Extraction complete, remove the loading from the OS progress bar.
    remote.getCurrentWindow().setProgressBar(-1)

    // Extraction completed successfully.
    ConfigManager.setJavaExecutable(ConfigManager.getSelectedServer(), newJavaExec)
    ConfigManager.save()

    clearInterval(extractListener)
    setLaunchDetails(Lang.queryJS('landing.downloadJava.javaInstalled'))

    // TODO Callback hell
    // Refactor the launch functions
    asyncSystemScan(effectiveJavaOptions, launchAfter)

}

// Keep reference to Minecraft Process
let proc
// Is DiscordRPC enabled
let hasRPC = false
// Joined server regex
// Change this if your server uses something different.
const GAME_JOINED_REGEX = /\[.+\]: Sound engine started/
const GAME_LAUNCH_REGEX = /^\[.+\]: (?:MinecraftForge .+ Initialized|ModLauncher .+ starting: .+|Loading Minecraft .+ with Fabric Loader .+)$/
const MIN_LINGER = 5000

async function dlAsync(login = true) {

    // Login parameter is temporary for debug purposes. Allows testing the validation/downloads without
    // launching the game.

    const loggerLaunchSuite = LoggerUtil.getLogger('LaunchSuite')

    setLaunchDetails(Lang.queryJS('landing.dlAsync.loadingServerInfo'))

    let distro

    try {
        distro = await DistroAPI.refreshDistributionOrFallback()
        onDistroRefresh(distro)
    } catch(err) {
        loggerLaunchSuite.error('Unable to refresh distribution index.', err)
        showLaunchFailure(Lang.queryJS('landing.dlAsync.fatalError'), Lang.queryJS('landing.dlAsync.unableToLoadDistributionIndex'))
        return
    }

    const serv = distro.getServerById(ConfigManager.getSelectedServer())

    // Suppression de la vérification d'authentification pour le patcheur
    // if(login) {
    //     if(ConfigManager.getSelectedAccount() == null){
    //         loggerLanding.error('You must be logged into an account.')
    //         return
    //     }
    // }

    setLaunchDetails(Lang.queryJS('landing.dlAsync.pleaseWait'))
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    const fullRepairModule = new FullRepair(
        ConfigManager.getCommonDirectory(),
        ConfigManager.getInstanceDirectory(),
        ConfigManager.getLauncherDirectory(),
        ConfigManager.getSelectedServer(),
        DistroAPI.isDevMode()
    )

    fullRepairModule.spawnReceiver()

    fullRepairModule.childProcess.on('error', (err) => {
        loggerLaunchSuite.error('Error during launch', err)
        showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), err.message || Lang.queryJS('landing.dlAsync.errorDuringLaunchText'))
    })
    fullRepairModule.childProcess.on('close', (code, _signal) => {
        if(code !== 0){
            loggerLaunchSuite.error(`Full Repair Module exited with code ${code}, assuming error.`)
            showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
        }
    })

    loggerLaunchSuite.info('Validating files.')
    setLaunchDetails(Lang.queryJS('landing.dlAsync.validatingFileIntegrity'))
    let invalidFileCount = 0
    try {
        invalidFileCount = await fullRepairModule.verifyFiles(percent => {
            const limitedPercent = Math.min(Math.max(percent, 0), 100)
            setLaunchPercentage(limitedPercent)
        })
        setLaunchPercentage(100)
    } catch (err) {
        loggerLaunchSuite.error('Error during file validation.')
        showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringFileVerificationTitle'), err.displayable || Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
        return
    }
    

    if(invalidFileCount > 0) {
        loggerLaunchSuite.info('Downloading files.')
        setLaunchDetails(Lang.queryJS('landing.dlAsync.downloadingFiles'))
        setLaunchPercentage(0)
        try {
            await fullRepairModule.download(percent => {
                const limitedPercent = Math.min(Math.max(percent, 0), 100)
                setDownloadPercentage(limitedPercent)
            })
            setDownloadPercentage(100)
        } catch(err) {
            loggerLaunchSuite.error('Error during file download.')
            showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringFileDownloadTitle'), err.displayable || Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
            return
        }
    } else {
        loggerLaunchSuite.info('No invalid files, skipping download.')
    }

    // Remove download bar.
    remote.getCurrentWindow().setProgressBar(-1)

    fullRepairModule.destroyReceiver()

    setLaunchDetails(Lang.queryJS('landing.dlAsync.preparingToLaunch'))

    const mojangIndexProcessor = new MojangIndexProcessor(
        ConfigManager.getCommonDirectory(),
        serv.rawServer.minecraftVersion)
    const distributionIndexProcessor = new DistributionIndexProcessor(
        ConfigManager.getCommonDirectory(),
        distro,
        serv.rawServer.id
    )

    const modLoaderData = await distributionIndexProcessor.loadModLoaderVersionJson(serv)
    const versionData = await mojangIndexProcessor.getVersionJson()

    if(login) {
        // Compte fictif pour le patcheur Metin 2
        const authUser = {
            displayName: 'Patcher',
            uuid: '00000000-0000-0000-0000-000000000000',
            accessToken: 'offline'
        }
        loggerLaunchSuite.info(`Sending offline account for patcher to ProcessBuilder.`)
        let pb = new ProcessBuilder(serv, versionData, modLoaderData, authUser, remote.app.getVersion())
        setLaunchDetails(Lang.queryJS('landing.dlAsync.launchingGame'))

        // const SERVER_JOINED_REGEX = /\[.+\]: \[CHAT\] [a-zA-Z0-9_]{1,16} joined the game/
        const SERVER_JOINED_REGEX = new RegExp(`\\[.+\\]: \\[CHAT\\] ${authUser.displayName} joined the game`)

        const onLoadComplete = () => {
            toggleLaunchArea(false)
            if(hasRPC){
                DiscordWrapper.updateDetails(Lang.queryJS('landing.discord.loading'))
                proc.stdout.on('data', gameStateChange)
            }
            proc.stdout.removeListener('data', tempListener)
            proc.stderr.removeListener('data', gameErrorListener)
        }
        const start = Date.now()

        // Attach a temporary listener to the client output.
        // Will wait for a certain bit of text meaning that
        // the client application has started, and we can hide
        // the progress bar stuff.
        const tempListener = function(data){
            if(GAME_LAUNCH_REGEX.test(data.trim())){
                const diff = Date.now()-start
                if(diff < MIN_LINGER) {
                    setTimeout(onLoadComplete, MIN_LINGER-diff)
                } else {
                    onLoadComplete()
                }
            }
        }

        // Listener for Discord RPC.
        const gameStateChange = function(data){
            data = data.trim()
            if(SERVER_JOINED_REGEX.test(data)){
                DiscordWrapper.updateDetails(Lang.queryJS('landing.discord.joined'))
            } else if(GAME_JOINED_REGEX.test(data)){
                DiscordWrapper.updateDetails(Lang.queryJS('landing.discord.joining'))
            }
        }

        const gameErrorListener = function(data){
            data = data.trim()
            if(data.indexOf('Could not find or load main class net.minecraft.launchwrapper.Launch') > -1){
                loggerLaunchSuite.error('Game launch failed, LaunchWrapper was not downloaded properly.')
                showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), Lang.queryJS('landing.dlAsync.launchWrapperNotDownloaded'))
            }
        }

        try {
            // Build Minecraft process.
            proc = pb.build()

            // Bind listeners to stdout.
            proc.stdout.on('data', tempListener)
            proc.stderr.on('data', gameErrorListener)

            setLaunchDetails(Lang.queryJS('landing.dlAsync.doneEnjoyServer'))

            // Init Discord Hook
            if(distro.rawDistribution.discord != null && serv.rawServer.discord != null){
                DiscordWrapper.initRPC(distro.rawDistribution.discord, serv.rawServer.discord)
                hasRPC = true
                proc.on('close', (code, signal) => {
                    loggerLaunchSuite.info('Shutting down Discord Rich Presence..')
                    DiscordWrapper.shutdownRPC()
                    hasRPC = false
                    proc = null
                })
            }

        } catch(err) {

            loggerLaunchSuite.error('Error during launch', err)
            showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), Lang.queryJS('landing.dlAsync.checkConsoleForDetails'))

        }
    }

}

/**
 * News Loading Functions
 */

// DOM Cache
const newsContent                   = document.getElementById('newsContent')
const newsArticleTitle              = document.getElementById('newsArticleTitle')
const newsArticleDate               = document.getElementById('newsArticleDate')
const newsArticleAuthor             = document.getElementById('newsArticleAuthor')
const newsArticleComments           = document.getElementById('newsArticleComments')
const newsNavigationStatus          = document.getElementById('newsNavigationStatus')
const newsArticleContentScrollable  = document.getElementById('newsArticleContentScrollable')
const nELoadSpan                    = document.getElementById('nELoadSpan')

// News slide caches.
let newsActive = false
let newsGlideCount = 0

/**
 * Show the news UI via a slide animation.
 * 
 * @param {boolean} up True to slide up, otherwise false. 
 */
function slide_(up){
    const lCUpper = document.querySelector('#landingContainer > #upper')
    const lCLLeft = document.querySelector('#landingContainer > #lower > #left')
    const lCLCenter = document.querySelector('#landingContainer > #lower > #center')
    const lCLRight = document.querySelector('#landingContainer > #lower > #right')
    const newsBtn = document.querySelector('#landingContainer > #lower > #center #content')
    const landingContainer = document.getElementById('landingContainer')
    const newsContainer = document.querySelector('#landingContainer > #newsContainer')

    newsGlideCount++

    if(up){
        lCUpper.style.top = '-200vh'
        lCLLeft.style.top = '-200vh'
        lCLCenter.style.top = '-200vh'
        lCLRight.style.top = '-200vh'
        newsBtn.style.top = '130vh'
        newsContainer.style.top = '0px'
        //date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})
        //landingContainer.style.background = 'rgba(29, 29, 29, 0.55)'
        landingContainer.style.background = 'rgba(0, 0, 0, 0.50)'
        setTimeout(() => {
            if(newsGlideCount === 1){
                lCLCenter.style.transition = 'none'
                newsBtn.style.transition = 'none'
            }
            newsGlideCount--
        }, 2000)
    } else {
        setTimeout(() => {
            newsGlideCount--
        }, 2000)
        landingContainer.style.background = null
        lCLCenter.style.transition = null
        newsBtn.style.transition = null
        newsContainer.style.top = '100%'
        lCUpper.style.top = '0px'
        lCLLeft.style.top = '0px'
        lCLCenter.style.top = '0px'
        lCLRight.style.top = '0px'
        newsBtn.style.top = '10px'
    }
}

// Bind news button.
document.getElementById('newsButton').onclick = () => {
    // Toggle tabbing.
    if(newsActive){
        $('#landingContainer *').removeAttr('tabindex')
        $('#newsContainer *').attr('tabindex', '-1')
    } else {
        $('#landingContainer *').attr('tabindex', '-1')
        $('#newsContainer, #newsContainer *, #lower, #lower #center *').removeAttr('tabindex')
        if(newsAlertShown){
            $('#newsButtonAlert').fadeOut(2000)
            newsAlertShown = false
            ConfigManager.setNewsCacheDismissed(true)
            ConfigManager.save()
        }
    }
    slide_(!newsActive)
    newsActive = !newsActive
}

// Array to store article meta.
let newsArr = null

// News load animation listener.
let newsLoadingListener = null

/**
 * Set the news loading animation.
 * 
 * @param {boolean} val True to set loading animation, otherwise false.
 */
function setNewsLoading(val){
    if(val){
        const nLStr = Lang.queryJS('landing.news.checking')
        let dotStr = '..'
        nELoadSpan.innerHTML = nLStr + dotStr
        newsLoadingListener = setInterval(() => {
            if(dotStr.length >= 3){
                dotStr = ''
            } else {
                dotStr += '.'
            }
            nELoadSpan.innerHTML = nLStr + dotStr
        }, 750)
    } else {
        if(newsLoadingListener != null){
            clearInterval(newsLoadingListener)
            newsLoadingListener = null
        }
    }
}

// Bind retry button.
newsErrorRetry.onclick = () => {
    $('#newsErrorFailed').fadeOut(250, () => {
        initNews()
        $('#newsErrorLoading').fadeIn(250)
    })
}

newsArticleContentScrollable.onscroll = (e) => {
    if(e.target.scrollTop > Number.parseFloat($('.newsArticleSpacerTop').css('height'))){
        newsContent.setAttribute('scrolled', '')
    } else {
        newsContent.removeAttribute('scrolled')
    }
}

/**
 * Reload the news without restarting.
 * 
 * @returns {Promise.<void>} A promise which resolves when the news
 * content has finished loading and transitioning.
 */
function reloadNews(){
    return new Promise((resolve, reject) => {
        $('#newsContent').fadeOut(250, () => {
            $('#newsErrorLoading').fadeIn(250)
            initNews().then(() => {
                resolve()
            })
        })
    })
}

let newsAlertShown = false

/**
 * Show the news alert indicating there is new news.
 */
function showNewsAlert(){
    newsAlertShown = true
    $(newsButtonAlert).fadeIn(250)
}

async function digestMessage(str) {
    const msgUint8 = new TextEncoder().encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    return hashHex
}

/**
 * Initialize News UI. This will load the news and prepare
 * the UI accordingly.
 * 
 * @returns {Promise.<void>} A promise which resolves when the news
 * content has finished loading and transitioning.
 */
async function initNews(){

    setNewsLoading(true)

    const news = await loadNews()

    newsArr = news?.articles || null

    if(newsArr == null){
        // News Loading Failed
        setNewsLoading(false)

        await $('#newsErrorLoading').fadeOut(250).promise()
        await $('#newsErrorFailed').fadeIn(250).promise()

    } else if(newsArr.length === 0) {
        // No News Articles
        setNewsLoading(false)

        ConfigManager.setNewsCache({
            date: null,
            content: null,
            dismissed: false
        })
        ConfigManager.save()

        await $('#newsErrorLoading').fadeOut(250).promise()
        await $('#newsErrorNone').fadeIn(250).promise()
    } else {
        // Success
        setNewsLoading(false)

        const lN = newsArr[0]
        const cached = ConfigManager.getNewsCache()
        let newHash = await digestMessage(lN.content)
        let newDate = new Date(lN.date)
        let isNew = false

        if(cached.date != null && cached.content != null){

            if(new Date(cached.date) >= newDate){

                // Compare Content
                if(cached.content !== newHash){
                    isNew = true
                    showNewsAlert()
                } else {
                    if(!cached.dismissed){
                        isNew = true
                        showNewsAlert()
                    }
                }

            } else {
                isNew = true
                showNewsAlert()
            }

        } else {
            isNew = true
            showNewsAlert()
        }

        if(isNew){
            ConfigManager.setNewsCache({
                date: newDate.getTime(),
                content: newHash,
                dismissed: false
            })
            ConfigManager.save()
        }

        const switchHandler = (forward) => {
            let cArt = parseInt(newsContent.getAttribute('article'))
            let nxtArt = forward ? (cArt >= newsArr.length-1 ? 0 : cArt + 1) : (cArt <= 0 ? newsArr.length-1 : cArt - 1)
    
            displayArticle(newsArr[nxtArt], nxtArt+1)
        }

        document.getElementById('newsNavigateRight').onclick = () => { switchHandler(true) }
        document.getElementById('newsNavigateLeft').onclick = () => { switchHandler(false) }
        await $('#newsErrorContainer').fadeOut(250).promise()
        displayArticle(newsArr[0], 1)
        await $('#newsContent').fadeIn(250).promise()
    }


}

/**
 * Add keyboard controls to the news UI. Left and right arrows toggle
 * between articles. If you are on the landing page, the up arrow will
 * open the news UI.
 */
document.addEventListener('keydown', (e) => {
    if(newsActive){
        if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
            document.getElementById(e.key === 'ArrowRight' ? 'newsNavigateRight' : 'newsNavigateLeft').click()
        }
        // Interferes with scrolling an article using the down arrow.
        // Not sure of a straight forward solution at this point.
        // if(e.key === 'ArrowDown'){
        //     document.getElementById('newsButton').click()
        // }
    } else {
        if(getCurrentView() === VIEWS.landing){
            if(e.key === 'ArrowUp'){
                document.getElementById('newsButton').click()
            }
        }
    }
})

/**
 * Display a news article on the UI.
 * 
 * @param {Object} articleObject The article meta object.
 * @param {number} index The article index.
 */
function displayArticle(articleObject, index){
    newsArticleTitle.innerHTML = articleObject.title
    newsArticleTitle.href = articleObject.link
    newsArticleAuthor.innerHTML = 'by ' + articleObject.author
    newsArticleDate.innerHTML = articleObject.date
    newsArticleComments.innerHTML = articleObject.comments
    newsArticleComments.href = articleObject.commentsLink
    newsArticleContentScrollable.innerHTML = '<div id="newsArticleContentWrapper"><div class="newsArticleSpacerTop"></div>' + articleObject.content + '<div class="newsArticleSpacerBot"></div></div>'
    Array.from(newsArticleContentScrollable.getElementsByClassName('bbCodeSpoilerButton')).forEach(v => {
        v.onclick = () => {
            const text = v.parentElement.getElementsByClassName('bbCodeSpoilerText')[0]
            text.style.display = text.style.display === 'block' ? 'none' : 'block'
        }
    })
    newsNavigationStatus.innerHTML = Lang.query('ejs.landing.newsNavigationStatus', {currentPage: index, totalPages: newsArr.length})
    newsContent.setAttribute('article', index-1)
}

/**
 * Load news information from the RSS feed specified in the
 * distribution index.
 */
async function loadNews(){

    // Use configured RSS feed
    const newsFeed = RSS_FEED_URL

    const promise = new Promise((resolve, reject) => {
        
        const newsHost = new URL(newsFeed).origin + '/'
        $.ajax({
            url: newsFeed,
            success: (data) => {
                const items = $(data).find('item')
                const articles = []

                for(let i=0; i<items.length; i++){
                // JQuery Element
                    const el = $(items[i])

                    // Resolve date.
                    const date = new Date(el.find('pubDate').text()).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})

                    // Resolve comments.
                    let comments = el.find('slash\\:comments').text() || '0'
                    comments = comments + ' Comment' + (comments === '1' ? '' : 's')

                    // Fix relative links in content.
                    let content = el.find('content\\:encoded').text()
                    let regex = /src="(?!http:\/\/|https:\/\/)(.+?)"/g
                    let matches
                    while((matches = regex.exec(content))){
                        content = content.replace(`"${matches[1]}"`, `"${newsHost + matches[1]}"`)
                    }

                    let link   = el.find('link').text()
                    let title  = el.find('title').text()
                    let author = el.find('dc\\:creator').text()

                    // Generate article.
                    articles.push(
                        {
                            link,
                            title,
                            date,
                            author,
                            content,
                            comments,
                            commentsLink: link + '#comments'
                        }
                    )
                }
                resolve({
                    articles
                })
            },
            timeout: 2500
        }).catch(err => {
            resolve({
                articles: null
            })
        })
    })

    return await promise
}

/*******************************************************************************
 *                                                                             *
 * Tips System - Le saviez-vous                                               *
 *                                                                             *
 ******************************************************************************/

// Liste des phrases "Le saviez-vous"
const tipsList = [
    "Le serveur saisonnier est le premier en France.",
    "Le serveur général est un serveur roleplay.",
    "YourServerName est géré par l'équipe de Cheat-Gam3, 700,000 membres depuis 2008.",
    "1 launcher, 1 client, 2 serveurs.",
    "YourServerName est fait entièrement par notre équipe.",
    "CrdaN le gérant est en Corée et a du décalage horaire.",
    "Les saisons du serveur Saisonnier durent plusieurs mois.",
    "Le serveur général conserve votre progression."
]

let currentTipIndex = 0
let tipsInterval = null

/**
 * Affiche une phrase avec une animation de fondu
 */
function showTip(tipText) {
    const tipsTextElement = document.getElementById('tipsText')
    
    if (!tipsTextElement) {
        console.warn('Élément tipsText non trouvé')
        return
    }
    
    // Animation de sortie
    tipsTextElement.classList.add('fade-out')
    
    setTimeout(() => {
        // Changer le texte
        tipsTextElement.textContent = tipText
        
        // Animation d'entrée
        tipsTextElement.classList.remove('fade-out')
        tipsTextElement.classList.add('fade-in')
        
        // Retirer la classe fade-in après l'animation
        setTimeout(() => {
            tipsTextElement.classList.remove('fade-in')
        }, 300)
    }, 300)
}

/**
 * Passe à la phrase suivante
 */
function nextTip() {
    currentTipIndex = (currentTipIndex + 1) % tipsList.length
    showTip(tipsList[currentTipIndex])
}

/**
 * Initialise le système de tips
 */
function initializeTipsSystem() {
    console.log('Initialisation du système de tips...')
    
    // Vérifier que l'élément existe
    const tipsTextElement = document.getElementById('tipsText')
    if (!tipsTextElement) {
        console.warn('Élément tipsText non trouvé, système de tips désactivé')
        return
    }
    
    // Afficher la première phrase
    showTip(tipsList[currentTipIndex])
    
    // Démarrer l'intervalle pour changer les phrases
    // Intervalle aléatoire entre 5 et 10 secondes
    const getRandomInterval = () => Math.random() * 7000 + 15000 // 7-15 secondes
    
    const scheduleNextTip = () => {
        tipsInterval = setTimeout(() => {
            nextTip()
            scheduleNextTip() // Programmer le prochain changement
        }, getRandomInterval())
    }
    
    // Démarrer le premier changement
    scheduleNextTip()
    
    console.log('Système de tips initialisé avec', tipsList.length, 'phrases')
}

/**
 * Arrête le système de tips
 */
function stopTipsSystem() {
    if (tipsInterval) {
        clearTimeout(tipsInterval)
        tipsInterval = null
        console.log('Système de tips arrêté')
    }
}

// Initialiser le système de tips au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Attendre un peu que tous les éléments soient chargés
    setTimeout(() => {
        initializeTipsSystem()
    }, 1000)
})

// Exporter les fonctions pour un usage externe si nécessaire
window.initializeTipsSystem = initializeTipsSystem
window.stopTipsSystem = stopTipsSystem

/*******************************************************************************
 *                                                                             *
 * Login System - Authentification utilisateur                                *
 *                                                                             *
 ******************************************************************************/

// Configuration de l'API
const API_CONFIG = {
    url: API_URL,
    key: API_KEY
};

// Variables globales pour l'authentification
let currentUser = null;
let isLoggingIn = false;

/**
 * Affiche une erreur de connexion
 */
function showLoginError(message) {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
        
        // Masquer l'erreur après 5 secondes
        setTimeout(() => {
            loginError.style.display = 'none';
        }, 5000);
    }
}

/**
 * Masque l'erreur de connexion
 */
function hideLoginError() {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.style.display = 'none';
    }
}

/**
 * Active/désactive l'état de chargement
 */
function setLoadingState(loading) {
    isLoggingIn = loading;
    const loginButton = document.getElementById('loginButton');
    const loginButtonText = document.getElementById('loginButtonText');
    const loginSpinner = document.getElementById('loginSpinner');
    
    if (loginButton) {
        loginButton.disabled = loading;
    }
    
    if (loading) {
        if (loginButtonText) loginButtonText.style.display = 'none';
        if (loginSpinner) loginSpinner.style.display = 'block';
    } else {
        if (loginButtonText) loginButtonText.style.display = 'block';
        if (loginSpinner) loginSpinner.style.display = 'none';
    }
}

/**
 * Valide les données de connexion
 */
function validateLoginData(username, password) {
    if (!username || username.trim().length === 0) {
        showLoginError('Veuillez entrer votre nom d\'utilisateur ou email');
        return false;
    }
    
    if (!password || password.length === 0) {
        showLoginError('Veuillez entrer votre mot de passe');
        return false;
    }
    
    if (username.length < 3) {
        showLoginError('Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return false;
    }
    
    if (password.length < 6) {
        showLoginError('Le mot de passe doit contenir au moins 6 caractères');
        return false;
    }
    
    return true;
}

/**
 * Effectue une requête à l'API
 */
async function makeApiRequest(action, data = {}) {
    try {
        // Utiliser l'API fetch native d'Electron
        const requestData = JSON.stringify({
            action: action,
            ...data
        });
        
        const response = await fetch(API_CONFIG.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.key}`
            },
            body: requestData
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Erreur API:', error);
        throw new Error('Mauvais identifiant ou mot de passe');
    }
}

/**
 * Sauvegarde les credentials
 */
function saveCredentials(username, password) {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const credentialsFile = path.join(userDataPath, 'credentials.json');
        const credentials = {
            username: username,
            password: Buffer.from(password).toString('base64'),
            remember: true,
            timestamp: Date.now()
        };
        
        fs.writeFileSync(credentialsFile, JSON.stringify(credentials));
    } catch (error) {
        console.warn('Impossible de sauvegarder les credentials:', error);
    }
}

/**
 * Charge les credentials sauvegardés
 */
function loadSavedCredentials() {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const credentialsFile = path.join(userDataPath, 'credentials.json');
        
        if (fs.existsSync(credentialsFile)) {
            const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
            
            if (credentials.remember && credentials.username && credentials.password) {
                const usernameInput = document.getElementById('loginUsername');
                const passwordInput = document.getElementById('loginPassword');
                
                if (usernameInput) usernameInput.value = credentials.username;
                if (passwordInput) passwordInput.value = Buffer.from(credentials.password, 'base64').toString();
                
                return true;
            }
        }
    } catch (error) {
        console.warn('Impossible de charger les credentials:', error);
    }
    return false;
}

/**
 * Vérifie si l'utilisateur est déjà connecté
 */
async function checkExistingSession() {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const sessionFile = path.join(userDataPath, 'session.json');
        
        if (fs.existsSync(sessionFile)) {
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            
            // Vérifier si la session n'est pas trop ancienne (24h)
            if (Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000) {
                return sessionData.user;
            }
        }
    } catch (error) {
        console.warn('Erreur lors de la vérification de session:', error);
    }
    return null;
}

/**
 * Sauvegarde les données utilisateur
 */
function saveUserData(userData) {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const sessionFile = path.join(userDataPath, 'session.json');
        const sessionData = {
            user: userData,
            timestamp: Date.now()
        };
        
        fs.writeFileSync(sessionFile, JSON.stringify(sessionData));
        currentUser = userData;
    } catch (error) {
        console.warn('Impossible de sauvegarder les données utilisateur:', error);
    }
}

/**
 * Supprime les données utilisateur
 */
function clearUserData() {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const sessionFile = path.join(userDataPath, 'session.json');
        if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
        }
        
        currentUser = null;
    } catch (error) {
        console.warn('Impossible de supprimer les données utilisateur:', error);
    }
}

/**
 * Effectue la connexion
 */
async function performLogin(username, password) {
    try {
        hideLoginError();
        setLoadingState(true);
        
        const result = await makeApiRequest('login', {
            username: username,
            password: password
        });
        
        if (result.success) {
            // Connexion réussie
            saveUserData(result.data);
            saveCredentials(username, password);
            
            // Sauvegarder automatiquement le compte
            saveAccountToFile(username, password);
            
            // Masquer l'écran de connexion et afficher le launcher
            const loginContainer = document.getElementById('loginContainer');
            const mainContainer = document.getElementById('main');
            
            if (loginContainer) loginContainer.style.display = 'none';
            if (mainContainer) mainContainer.style.display = 'block';
            
            // Mettre à jour l'interface utilisateur
            updateUserInterface(result.data);
            
            console.log('Connexion réussie:', result.data);
        } else {
            // Erreur de connexion
            showLoginError(result.message || 'Erreur de connexion');
        }
    } catch (error) {
        showLoginError(error.message || 'Mauvais identifiant ou mot de passe');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Met à jour l'interface utilisateur avec les données de l'utilisateur
 */
function updateUserInterface(userData) {
    // Mettre à jour le nom d'utilisateur dans l'interface
    const userTextElement = document.getElementById('user_text');
    if (userTextElement) {
        userTextElement.textContent = userData.username;
    }
    
    // Mettre à jour l'avatar si nécessaire
    const avatarElement = document.querySelector('#avatarContainer img');
    if (avatarElement) {
        avatarElement.alt = userData.username;
    }
}

/**
 * Affiche l'écran de connexion
 */
function showLoginScreen() {
    const loginContainer = document.getElementById('loginContainer');
    const mainContainer = document.getElementById('main');
    
    if (loginContainer) loginContainer.style.display = 'block';
    if (mainContainer) mainContainer.style.display = 'none';
    
    // Réinitialiser le formulaire
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    
    hideLoginError();
}

/**
 * Gère la déconnexion
 */
function logout() {
    clearUserData();
    showLoginScreen();
}

/**
 * Initialise l'écran de connexion
 */
function initializeLogin() {
    console.log('Initialisation de l\'écran de connexion...');
    
    // Vérifier si l'utilisateur est déjà connecté
    checkExistingSession().then(userData => {
        if (userData) {
            // Utilisateur déjà connecté
            const loginContainer = document.getElementById('loginContainer');
            const mainContainer = document.getElementById('main');
            
            if (loginContainer) loginContainer.style.display = 'none';
            if (mainContainer) mainContainer.style.display = 'block';
            
            updateUserInterface(userData);
            console.log('Utilisateur déjà connecté:', userData);
        } else {
            // Charger les credentials sauvegardés
            loadSavedCredentials();
            
            const loginContainer = document.getElementById('loginContainer');
            const mainContainer = document.getElementById('main');
            
            if (loginContainer) loginContainer.style.display = 'block';
            if (mainContainer) mainContainer.style.display = 'none';
        }
    });
    
    // Gérer le clic sur le bouton de connexion
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            if (isLoggingIn) return;
            
            const usernameInput = document.getElementById('loginUsername');
            const passwordInput = document.getElementById('loginPassword');
            
            if (usernameInput && passwordInput) {
                const username = usernameInput.value.trim();
                const password = passwordInput.value;
                
                if (validateLoginData(username, password)) {
                    await performLogin(username, password);
                }
            }
        });
    }
    
    // Gérer la touche Entrée
    const passwordInput = document.getElementById('loginPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isLoggingIn) {
                const loginButton = document.getElementById('loginButton');
                if (loginButton) loginButton.click();
            }
        });
    }
    
    const usernameInput = document.getElementById('loginUsername');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isLoggingIn) {
                const passwordInput = document.getElementById('loginPassword');
                if (passwordInput) passwordInput.focus();
            }
        });
    }
    
    // Gérer le bouton de déconnexion
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log('Déconnexion demandée');
            logout();
        });
    }
}

// Exporter les fonctions pour un usage externe
window.ascend2Auth = {
    login: performLogin,
    logout: logout,
    getCurrentUser: () => currentUser,
    isLoggedIn: () => currentUser !== null
};

/*******************************************************************************
 *                                                                             *
 * Account Auto-Save System                                                   *
 *                                                                             *
 ******************************************************************************/

/**
 * Chiffrement Vigenère avec la clé "13"
 */
function vigenereEncrypt(text, key) {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charIndex = alphabet.indexOf(char);
        
        if (charIndex === -1) {
            // Caractère non supporté, le garder tel quel
            result += char;
        } else {
            const keyChar = key[i % key.length];
            const keyIndex = alphabet.indexOf(keyChar);
            const newIndex = (charIndex + keyIndex) % alphabet.length;
            result += alphabet[newIndex];
        }
    }
    
    return result;
}

/**
 * Déchiffrement Vigenère avec la clé "13"
 */
function vigenereDecrypt(text, key) {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charIndex = alphabet.indexOf(char);
        
        if (charIndex === -1) {
            // Caractère non supporté, le garder tel quel
            result += char;
        } else {
            const keyChar = key[i % key.length];
            const keyIndex = alphabet.indexOf(keyChar);
            const newIndex = (charIndex - keyIndex + alphabet.length) % alphabet.length;
            result += alphabet[newIndex];
        }
    }
    
    return result;
}

/**
 * Chiffre un mot de passe (Base64 + Vigenère)
 */
function encryptPassword(password) {
    // 1. Encoder en Base64
    const base64Password = Buffer.from(password).toString('base64');
    
    // 2. Appliquer Vigenère avec la clé "13"
    const encryptedPassword = vigenereEncrypt(base64Password, "13");
    
    return encryptedPassword;
}

/**
 * Déchiffre un mot de passe (Vigenère + Base64)
 */
function decryptPassword(encryptedPassword) {
    // 1. Déchiffrer Vigenère avec la clé "13"
    const base64Password = vigenereDecrypt(encryptedPassword, "13");
    
    // 2. Décoder Base64
    const password = Buffer.from(base64Password, 'base64').toString('utf8');
    
    return password;
}

/**
 * Parse le fichier account_data.inf
 */
function parseAccountData(content) {
    const accounts = {};
    const lines = content.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Section [account_X]
        const sectionMatch = trimmedLine.match(/^\[account_(\d+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            accounts[currentSection] = {};
            continue;
        }
        
        // Propriétés id = et pw =
        if (currentSection) {
            const idMatch = trimmedLine.match(/^id\s*=\s*(.+)$/);
            if (idMatch) {
                accounts[currentSection].id = idMatch[1];
                continue;
            }
            
            const pwMatch = trimmedLine.match(/^pw\s*=\s*(.+)$/);
            if (pwMatch) {
                accounts[currentSection].pw = pwMatch[1];
                continue;
            }
        }
    }
    
    return accounts;
}

/**
 * Génère le contenu du fichier account_data.inf
 */
function generateAccountDataContent(accounts) {
    let content = "";
    
    // Trouver le nombre maximum de slots utilisés
    const maxSlot = Math.max(0, ...Object.keys(accounts).map(Number));
    
    // Si aucun compte, créer un fichier vide
    if (maxSlot === 0) {
        return "";
    }
    
    // Créer seulement les slots nécessaires
    for (let i = 1; i <= maxSlot; i++) {
        const account = accounts[i];
        content += `[account_${i}]\n`;
        
        if (account && account.id && account.pw) {
            content += `id = ${account.id}\n`;
            content += `pw = ${account.pw}\n`;
        } else {
            content += `id = \n`;
            content += `pw = \n`;
        }
        
        content += "\n";
    }
    
    return content;
}

/**
 * Sauvegarde automatique d'un compte
 */
function saveAccountToFile(username, password) {
    try {
        const { app } = require('@electron/remote');
        const path = require('path');
        const fs = require('fs');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const userDataPath = path.join(gameDirectory, 'UserData');
        const accountDataFile = path.join(userDataPath, 'account_data.inf');
        
        // Créer le dossier UserData s'il n'existe pas
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        
        // Lire le fichier existant ou créer un nouveau
        let accounts = {};
        if (fs.existsSync(accountDataFile)) {
            const content = fs.readFileSync(accountDataFile, 'utf8');
            accounts = parseAccountData(content);
        }
        
        // Vérifier si le compte existe déjà
        let accountExists = false;
        let existingSlot = null;
        
        for (const [slot, account] of Object.entries(accounts)) {
            if (account.id === username) {
                accountExists = true;
                existingSlot = slot;
                break;
            }
        }
        
        if (accountExists) {
            console.log(`Compte ${username} déjà enregistré dans le slot ${existingSlot}`);
            return;
        }
        
        // Trouver un slot vide
        let emptySlot = null;
        for (let i = 1; i <= 12; i++) {
            if (!accounts[i] || !accounts[i].id) {
                emptySlot = i;
                break;
            }
        }
        
        if (!emptySlot) {
            console.log('Aucun slot disponible pour sauvegarder le compte');
            return;
        }
        
        // Chiffrer le mot de passe
        const encryptedPassword = encryptPassword(password);
        
        // Sauvegarder le compte
        accounts[emptySlot] = {
            id: username,
            pw: encryptedPassword
        };
        
        // Générer le contenu du fichier
        const content = generateAccountDataContent(accounts);
        
        // Écrire le fichier
        fs.writeFileSync(accountDataFile, content, 'utf8');
        
        console.log(`Compte ${username} sauvegardé dans le slot ${emptySlot}`);
        
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du compte:', error);
    }
}

/**
 * Charge les comptes sauvegardés
 */
function loadSavedAccounts() {
    try {
        const { app } = require('@electron/remote');
        const path = require('path');
        const fs = require('fs');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const userDataPath = path.join(gameDirectory, 'UserData');
        const accountDataFile = path.join(userDataPath, 'account_data.inf');
        
        if (!fs.existsSync(accountDataFile)) {
            return {};
        }
        
        const content = fs.readFileSync(accountDataFile, 'utf8');
        const accounts = parseAccountData(content);
        
        // Déchiffrer les mots de passe pour l'affichage
        const decryptedAccounts = {};
        for (const [slot, account] of Object.entries(accounts)) {
            if (account.id && account.pw) {
                try {
                    decryptedAccounts[slot] = {
                        id: account.id,
                        pw: decryptPassword(account.pw)
                    };
                } catch (error) {
                    console.error(`Erreur déchiffrement compte ${account.id}:`, error);
                }
            }
        }
        
        return decryptedAccounts;
        
    } catch (error) {
        console.error('Erreur lors du chargement des comptes:', error);
        return {};
    }
}

/**
 * Supprime un compte sauvegardé
 */
function removeSavedAccount(username) {
    try {
        const { app } = require('@electron/remote');
        const path = require('path');
        const fs = require('fs');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const userDataPath = path.join(gameDirectory, 'UserData');
        const accountDataFile = path.join(userDataPath, 'account_data.inf');
        
        if (!fs.existsSync(accountDataFile)) {
            return;
        }
        
        const content = fs.readFileSync(accountDataFile, 'utf8');
        const accounts = parseAccountData(content);
        
        // Trouver et supprimer le compte
        for (const [slot, account] of Object.entries(accounts)) {
            if (account.id === username) {
                delete accounts[slot];
                break;
            }
        }
        
        // Régénérer le fichier
        const newContent = generateAccountDataContent(accounts);
        fs.writeFileSync(accountDataFile, newContent, 'utf8');
        
        console.log(`Compte ${username} supprimé des sauvegardes`);
        
    } catch (error) {
        console.error('Erreur lors de la suppression du compte:', error);
    }
}

/*******************************************************************************
 *                                                                             *
 * Game Configuration System                                                  *
 *                                                                             *
 ******************************************************************************/

// Variables pour la configuration du jeu
let gameConfigShown = false;
let gameConfigData = null;

/**
 * Vérifie si la configuration du jeu a déjà été faite
 */
function hasGameConfigBeenSet() {
    try {
        const { app } = require('@electron/remote');
        const fs = require('fs');
        const path = require('path');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const configFile = path.join(gameDirectory, 'metin2.cfg');
        
        // Vérifier si le fichier metin2.cfg existe
        if (!fs.existsSync(configFile)) {
            return false; // Pas de fichier de config = premier lancement
        }
        
        // Vérifier si c'est un fichier de config par défaut (résolution 1024x768)
        const content = fs.readFileSync(configFile, 'utf8');
        if (content.includes('WIDTH\t\t\t\t1024') && content.includes('HEIGHT\t\t\t\t768')) {
            return false; // Config par défaut = premier lancement
        }
        
        return true; // Config personnalisée = pas le premier lancement
    } catch (error) {
        console.warn('Impossible de vérifier la configuration du jeu:', error);
        return false;
    }
}

/**
 * Sauvegarde la configuration du jeu
 */
function saveGameConfig(config) {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const configFile = path.join(userDataPath, 'game-config.json');
        fs.writeFileSync(configFile, JSON.stringify(config));
        gameConfigData = config;
        console.log('Configuration du jeu sauvegardée:', config);
    } catch (error) {
        console.warn('Impossible de sauvegarder la configuration du jeu:', error);
    }
}

/**
 * Charge la configuration du jeu
 */
function loadGameConfig() {
    try {
        const { app } = require('@electron/remote');
        const userDataPath = app.getPath('userData');
        const fs = require('fs');
        const path = require('path');
        
        const configFile = path.join(userDataPath, 'game-config.json');
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            gameConfigData = config;
            return config;
        }
    } catch (error) {
        console.warn('Impossible de charger la configuration du jeu:', error);
    }
    return null;
}

/**
 * Affiche l'écran de configuration du jeu
 */
function showGameConfigScreen() {
    const configContainer = document.getElementById('gameConfigContainer');
    if (configContainer) {
        configContainer.style.display = 'block';
        gameConfigShown = true;
        
        // Charger la configuration existante si elle existe
        const existingConfig = loadGameConfig();
        if (existingConfig) {
            const resolutionSelect = document.getElementById('configResolution');
            const fullscreenSelect = document.getElementById('configFullscreen');
            const qualitySelect = document.getElementById('configQuality');
            const musicVolumeSlider = document.getElementById('configMusicVolume');
            const volumeValue = document.getElementById('volumeValue');
            
            if (resolutionSelect) resolutionSelect.value = existingConfig.resolution || '1920x1080';
            if (fullscreenSelect) fullscreenSelect.value = existingConfig.fullscreen || '0';
            if (qualitySelect) qualitySelect.value = existingConfig.quality || 'medium';
            if (musicVolumeSlider) {
                const volume = existingConfig.musicVolume || '1.000';
                musicVolumeSlider.value = Math.round(parseFloat(volume) * 100);
                if (volumeValue) volumeValue.textContent = volume;
            }
        }
    }
}

/**
 * Cache l'écran de configuration du jeu
 */
function hideGameConfigScreen() {
    const configContainer = document.getElementById('gameConfigContainer');
    if (configContainer) {
        configContainer.style.display = 'none';
        gameConfigShown = false;
    }
}

/**
 * Applique la configuration du jeu au fichier metin2.cfg
 */
function applyGameConfig(config) {
    try {
        const { app } = require('@electron/remote');
        const path = require('path');
        const fs = require('fs');
        
        const gameDirectory = path.join(app.getPath('documents'), GAME_FOLDER_NAME);
        const configFile = path.join(gameDirectory, 'metin2.cfg');
        
        // Valeurs de qualité graphique
        const qualityValues = {
            'low': { DROP_EFFECT: 0, SHADOW_TARGET_LEVEL: 1, SHADOW_QUALITY_LEVEL: 0 },
            'medium': { DROP_EFFECT: 2, SHADOW_TARGET_LEVEL: 2, SHADOW_QUALITY_LEVEL: 1 },
            'high': { DROP_EFFECT: 4, SHADOW_TARGET_LEVEL: 3, SHADOW_QUALITY_LEVEL: 2 }
        };
        
        const quality = qualityValues[config.quality] || qualityValues['medium'];
        
        // Lire le fichier metin2.cfg existant ou créer un nouveau
        let configContent = '';
        if (fs.existsSync(configFile)) {
            configContent = fs.readFileSync(configFile, 'utf8');
        } else {
            console.log('Création du fichier metin2.cfg...');
            // Créer un fichier metin2.cfg par défaut
            configContent = `WIDTH\t\t\t\t1024
HEIGHT\t\t\t\t768
WINDOWED\t\t\t\t0
BPP\t\t\t\t32
FREQUENCY\t\t\t0
SOFTWARE_CURSOR\t\t0
OBJECT_CULLING\t\t\t1
VISIBILITY\t\t\t3
MUSIC_VOLUME\t\t\t1.000
VOICE_VOLUME\t\t\t5
GAMMA\t\t\t\t3
IS_SAVE_ID\t\t\t0
SAVE_ID\t\t\t\t0
DECOMPRESSED_TEXTURE\t\t0
shop_range\t0.500
DUNGEON_TRACK\t0
BOSS_TRACK\t0
BOSS_INFO\t\t\t\t1
DROP_EFFECT\t\t\t4
USE_DEFAULT_IME\t\t0
SOFTWARE_TILING\t\t0
SHADOW_TARGET_LEVEL\t\t0
SHADOW_QUALITY_LEVEL\t\t0
FOV\t\t\t\t30.00
DOG_MODE_STATUS\t\t\t0
RAIN_LEVEL\t\t\t\t0
STONE_SCALE\t\t\t1.000000
`;
            fs.writeFileSync(configFile, configContent);
        }
        
        // Calculer VOICE_VOLUME basé sur MUSIC_VOLUME (1-5, minimum 1)
        const musicVolumeFloat = parseFloat(config.musicVolume);
        const voiceVolume = Math.max(1, Math.round(musicVolumeFloat * 5));
        
        // Mettre à jour les paramètres
        const settings = {
            'WIDTH': config.resolution.split('x')[0],
            'HEIGHT': config.resolution.split('x')[1],
            'WINDOWED': config.fullscreen === '0' ? '1' : '0', // 1 = fenêtré, 0 = plein écran
            'MUSIC_VOLUME': config.musicVolume,
            'VOICE_VOLUME': voiceVolume,
            'DROP_EFFECT': quality.DROP_EFFECT,
            'SHADOW_TARGET_LEVEL': quality.SHADOW_TARGET_LEVEL,
            'SHADOW_QUALITY_LEVEL': quality.SHADOW_QUALITY_LEVEL
        };
        
        // Appliquer chaque paramètre (format avec tabulations comme dans le fichier original)
        Object.entries(settings).forEach(([key, value]) => {
            // Regex améliorée pour gérer les valeurs décimales et entières
            const regex = new RegExp(`^${key}\\s+[\\d.]+`, 'm');
            const newLine = `${key}\t\t\t\t${value}`;
            
            if (regex.test(configContent)) {
                configContent = configContent.replace(regex, newLine);
            } else {
                console.warn(`Paramètre ${key} non trouvé dans metin2.cfg`);
            }
        });
        
        // Écrire le fichier
        fs.writeFileSync(configFile, configContent);
        console.log('Configuration appliquée au fichier metin2.cfg:', settings);
        
    } catch (error) {
        console.error('Erreur lors de l\'application de la configuration:', error);
    }
}

/**
 * Initialise l'écran de configuration du jeu
 */
function initializeGameConfig() {
    // Gérer le slider de volume
    const musicVolumeSlider = document.getElementById('configMusicVolume');
    const volumeValue = document.getElementById('volumeValue');
    if (musicVolumeSlider && volumeValue) {
        musicVolumeSlider.addEventListener('input', () => {
            const value = musicVolumeSlider.value;
            const volume = (parseInt(value) / 100).toFixed(3);
            volumeValue.textContent = volume;
        });
    }
    
    // Gérer le bouton de sauvegarde
    const saveButton = document.getElementById('configSaveButton');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const resolution = document.getElementById('configResolution').value;
            const fullscreen = document.getElementById('configFullscreen').value;
            const quality = document.getElementById('configQuality').value;
            const musicVolumeSlider = document.getElementById('configMusicVolume');
            const musicVolume = musicVolumeSlider ? (parseInt(musicVolumeSlider.value) / 100).toFixed(3) : '1.000';
            
            const config = {
                resolution: resolution,
                fullscreen: fullscreen,
                quality: quality,
                musicVolume: musicVolume,
                timestamp: Date.now()
            };
            
            // Sauvegarder la configuration
            saveGameConfig(config);
            
            // Appliquer la configuration au jeu
            applyGameConfig(config);
            
            // Cacher l'écran de configuration
            hideGameConfigScreen();
            
            // Lancer le jeu
            launchAscend2Game();
        });
    }
    
    // Gérer le bouton d'annulation
    const cancelButton = document.getElementById('configCancelButton');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            hideGameConfigScreen();
        });
    }
}

/**
 * Vérifie si la configuration du jeu doit être affichée avant le lancement
 */
function checkGameConfigBeforeLaunch() {
    if (!hasGameConfigBeenSet()) {
        showGameConfigScreen();
        return true; // Configuration affichée
    }
    return false; // Pas de configuration nécessaire
}

// /**
//  * Initialise les paramètres Metin2 dans les settings
//  */
// function initializeMetin2SettingsGraphics() {
//     console.log('Initialisation des paramètres Metin2...');
    
//     // Charger la configuration existante
//     const existingConfig = loadGameConfig();
    
//     // Initialiser le volume de musique
//     const musicVolumeSlider = document.getElementById('metin2MusicVolume');
//     const musicVolumeValue = document.getElementById('metin2MusicVolumeValue');
//     if (musicVolumeSlider && musicVolumeValue) {
//         if (existingConfig && existingConfig.musicVolume) {
//             const volume = Math.round(parseFloat(existingConfig.musicVolume) * 100);
//             musicVolumeSlider.value = volume;
//             musicVolumeValue.textContent = volume + '%';
//         }
        
//         musicVolumeSlider.addEventListener('input', () => {
//             const value = musicVolumeSlider.value;
//             musicVolumeValue.textContent = value + '%';
//             saveMetin2Settings();
//         });
//     }
    
//     // Initialiser la qualité graphique
//     const graphicsQualitySelect = document.getElementById('metin2GraphicsQuality');
//     if (graphicsQualitySelect) {
//         if (existingConfig && existingConfig.quality) {
//             graphicsQualitySelect.value = existingConfig.quality;
//         }
        
//         graphicsQualitySelect.addEventListener('change', () => {
//             console.log('Qualité graphique changée:', graphicsQualitySelect.value);
//             saveMetin2Settings();
//         });
//     }
    
//     // Initialiser le mode plein écran
//     const fullscreenToggle = document.getElementById('metin2Fullscreen');
//     if (fullscreenToggle) {
//         if (existingConfig && existingConfig.fullscreen) {
//             fullscreenToggle.checked = existingConfig.fullscreen === '1';
//         }
        
//         fullscreenToggle.addEventListener('change', () => {
//             console.log('Mode plein écran changé:', fullscreenToggle.checked);
//             saveMetin2Settings();
//         });
//     }
    
//     console.log('Paramètres Metin2 initialisés');
// }

// /**
//  * Sauvegarde les paramètres Metin2 depuis les settings
//  */
// function saveMetin2Settings() {
//     console.log('Sauvegarde des paramètres Metin2...');
    
//     // Récupérer les valeurs des contrôles
//     const musicVolumeSlider = document.getElementById('metin2MusicVolume');
//     const graphicsQualitySelect = document.getElementById('metin2GraphicsQuality');
//     const fullscreenToggle = document.getElementById('metin2Fullscreen');
    
//     if (!musicVolumeSlider || !graphicsQualitySelect || !fullscreenToggle) {
//         console.error('Contrôles Metin2 non trouvés');
//         return;
//     }
    
//     // Calculer les valeurs
//     const musicVolume = (parseInt(musicVolumeSlider.value) / 100).toFixed(3);
//     const quality = graphicsQualitySelect.value;
//     const fullscreen = fullscreenToggle.checked ? '1' : '0';
    
//     // Créer la configuration
//     const config = {
//         resolution: '1920x1080', // Valeur par défaut, sera mise à jour si nécessaire
//         fullscreen: fullscreen,
//         quality: quality,
//         musicVolume: musicVolume,
//         timestamp: Date.now()
//     };
    
//     // Sauvegarder et appliquer
//     saveGameConfig(config);
//     applyGameConfig(config);
    
//     console.log('Paramètres Metin2 sauvegardés:', config);
// }

// Exporter les fonctions pour l'usage externe
window.initializeMetin2Settings = initializeMetin2Settings;
//window.initializeMetin2SettingsGraphics = initializeMetin2SettingsGraphics;
//window.saveMetin2Settings = saveMetin2Settings;

// Initialiser l'écran de connexion au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser le système de connexion immédiatement
    initializeLogin();
    
    // Initialiser le système de configuration du jeu
    initializeGameConfig();
});
