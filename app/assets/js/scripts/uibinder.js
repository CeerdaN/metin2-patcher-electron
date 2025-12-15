/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path          = require('path')
const { Type }      = require('helios-distribution-types')

// const AuthManager   = require('./assets/js/authmanager') // Removed for patcher
const ConfigManager = require('./assets/js/configmanager')
const { DistroAPI } = require('./assets/js/distromanager')

let rscShouldLoad = false
let fatalStartupError = false

// Mapping of each view to their container IDs.
const VIEWS = {
    landing: '#landingContainer',
    settings: '#settingsContainer'
}

// The currently shown view container.
let currentView

/**
 * Switch launcher views.
 * 
 * @param {string} current The ID of the current view container. 
 * @param {*} next The ID of the next view container.
 * @param {*} currentFadeTime Optional. The fade out time for the current view.
 * @param {*} nextFadeTime Optional. The fade in time for the next view.
 * @param {*} onCurrentFade Optional. Callback function to execute when the current
 * view fades out.
 * @param {*} onNextFade Optional. Callback function to execute when the next view
 * fades in.
 */
function switchView(current, next, currentFadeTime = 500, nextFadeTime = 500, onCurrentFade = () => {}, onNextFade = () => {}){
    currentView = next
    $(`${current}`).fadeOut(currentFadeTime, async () => {
        await onCurrentFade()
        $(`${next}`).fadeIn(nextFadeTime, async () => {
            await onNextFade()
        })
    })
}

/**
 * Get the currently shown view container.
 * 
 * @returns {string} The currently shown view container.
 */
function getCurrentView(){
    return currentView
}

async function showMainUI(data){
    console.log('showMainUI called for patcher mode')

    // Auto updater désactivé
    // if(!isDev){
    //     console.log('Initializing auto updater...')
    //     ipcRenderer.send('autoUpdateAction', 'initAutoUpdater', ConfigManager.getAllowPrerelease())
    // }

    // Ultra-simplified initialization for patcher mode
    console.log('Patcher mode - skipping all complex initialization')
    
    setTimeout(() => {
        document.getElementById('frameBar').style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        document.body.style.backgroundImage = `url('assets/images/backgrounds/${document.body.getAttribute('bkid')}.jpg')`
        document.body.style.backgroundSize = 'cover'
        document.body.style.backgroundPosition = 'center'
        document.body.style.backgroundRepeat = 'no-repeat'
        document.body.style.backgroundAttachment = 'fixed'
        
        // Ajouter l'effet de zoom en boucle
        startBackgroundZoom()
        
        // Ajouter l'effet de lueur animé
        startBackgroundGlow()
        
        $('#main').show()

        // Patcher mode - Always go directly to landing page
                currentView = VIEWS.landing
                $(VIEWS.landing).fadeIn(1000)

        setTimeout(() => {
            $('#loadingContainer').fadeOut(500, () => {
                $('#loadSpinnerImage').removeClass('rotating')
            })
        }, 250)
        
    }, 750)
    
    // Initialize news for Ascend 2 RSS feed
    initNews().then(() => {
        $('#newsContainer *').attr('tabindex', '-1')
    })
}

function showFatalStartupError(){
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                Lang.queryJS('uibinder.startup.fatalErrorTitle'),
                Lang.queryJS('uibinder.startup.fatalErrorMessage'),
                Lang.queryJS('uibinder.startup.closeButton')
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}

/**
 * Common functions to perform after refreshing the distro index.
 * 
 * @param {Object} data The distro index object.
 */
function onDistroRefresh(data){
    updateSelectedServer(data.getServerById(ConfigManager.getSelectedServer()))
    refreshServerStatus()
    initNews()
    syncModConfigurations(data)
    ensureJavaSettings(data)
}

/**
 * Sync the mod configurations with the distro index.
 * 
 * @param {Object} data The distro index object.
 */
function syncModConfigurations(data){

    const syncedCfgs = []

    for(let serv of data.servers){

        const id = serv.rawServer.id
        const mdls = serv.modules
        const cfg = ConfigManager.getModConfiguration(id)

        if(cfg != null){

            const modsOld = cfg.mods
            const mods = {}

            for(let mdl of mdls){
                const type = mdl.rawModule.type

                if(type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod){
                    if(!mdl.getRequired().value){
                        const mdlID = mdl.getVersionlessMavenIdentifier()
                        if(modsOld[mdlID] == null){
                            mods[mdlID] = scanOptionalSubModules(mdl.subModules, mdl)
                        } else {
                            mods[mdlID] = mergeModConfiguration(modsOld[mdlID], scanOptionalSubModules(mdl.subModules, mdl), false)
                        }
                    } else {
                        if(mdl.subModules.length > 0){
                            const mdlID = mdl.getVersionlessMavenIdentifier()
                            const v = scanOptionalSubModules(mdl.subModules, mdl)
                            if(typeof v === 'object'){
                                if(modsOld[mdlID] == null){
                                    mods[mdlID] = v
                                } else {
                                    mods[mdlID] = mergeModConfiguration(modsOld[mdlID], v, true)
                                }
                            }
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        } else {

            const mods = {}

            for(let mdl of mdls){
                const type = mdl.rawModule.type
                if(type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod){
                    if(!mdl.getRequired().value){
                        mods[mdl.getVersionlessMavenIdentifier()] = scanOptionalSubModules(mdl.subModules, mdl)
                    } else {
                        if(mdl.subModules.length > 0){
                            const v = scanOptionalSubModules(mdl.subModules, mdl)
                            if(typeof v === 'object'){
                                mods[mdl.getVersionlessMavenIdentifier()] = v
                            }
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        }
    }

    ConfigManager.setModConfigurations(syncedCfgs)
    ConfigManager.save()
}

/**
 * Ensure java configurations are present for the available servers.
 * 
 * @param {Object} data The distro index object.
 */
function ensureJavaSettings(data) {

    // Nothing too fancy for now.
    for(const serv of data.servers){
        ConfigManager.ensureJavaConfig(serv.rawServer.id, serv.effectiveJavaOptions, serv.rawServer.javaOptions?.ram)
    }

    ConfigManager.save()
}

/**
 * Recursively scan for optional sub modules. If none are found,
 * this function returns a boolean. If optional sub modules do exist,
 * a recursive configuration object is returned.
 * 
 * @returns {boolean | Object} The resolved mod configuration.
 */
function scanOptionalSubModules(mdls, origin){
    if(mdls != null){
        const mods = {}

        for(let mdl of mdls){
            const type = mdl.rawModule.type
            // Optional types.
            if(type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod){
                // It is optional.
                if(!mdl.getRequired().value){
                    mods[mdl.getVersionlessMavenIdentifier()] = scanOptionalSubModules(mdl.subModules, mdl)
                } else {
                    if(mdl.hasSubModules()){
                        const v = scanOptionalSubModules(mdl.subModules, mdl)
                        if(typeof v === 'object'){
                            mods[mdl.getVersionlessMavenIdentifier()] = v
                        }
                    }
                }
            }
        }

        if(Object.keys(mods).length > 0){
            const ret = {
                mods
            }
            if(!origin.getRequired().value){
                ret.value = origin.getRequired().def
            }
            return ret
        }
    }
    return origin.getRequired().def
}

/**
 * Recursively merge an old configuration into a new configuration.
 * 
 * @param {boolean | Object} o The old configuration value.
 * @param {boolean | Object} n The new configuration value.
 * @param {boolean} nReq If the new value is a required mod.
 * 
 * @returns {boolean | Object} The merged configuration.
 */
function mergeModConfiguration(o, n, nReq = false){
    if(typeof o === 'boolean'){
        if(typeof n === 'boolean') return o
        else if(typeof n === 'object'){
            if(!nReq){
                n.value = o
            }
            return n
        }
    } else if(typeof o === 'object'){
        if(typeof n === 'boolean') return typeof o.value !== 'undefined' ? o.value : true
        else if(typeof n === 'object'){
            if(!nReq){
                n.value = typeof o.value !== 'undefined' ? o.value : true
            }

            const newMods = Object.keys(n.mods)
            for(let i=0; i<newMods.length; i++){

                const mod = newMods[i]
                if(o.mods[mod] != null){
                    n.mods[mod] = mergeModConfiguration(o.mods[mod], n.mods[mod])
                }
            }

            return n
        }
    }
    // If for some reason we haven't been able to merge,
    // wipe the old value and use the new one. Just to be safe
    return n
}

// Removed validateSelectedAccount function for patcher mode

// Removed setSelectedAccount function for patcher mode

// Add stub functions to avoid errors
function loginOptionsCancelEnabled(val) {
    // Stub function for patcher mode
}

function loginCancelEnabled(val) {
    // Stub function for patcher mode
}

function validateEmail(email) {
    // Stub function for patcher mode
}

// Add missing view constants
const VIEWS_EXTRA = {
    loginOptions: '#loginOptionsContainer',
    login: '#loginContainer', 
    welcome: '#welcomeContainer',
    waiting: '#waitingContainer'
}

// Merge with existing VIEWS
Object.assign(VIEWS, VIEWS_EXTRA)

// Force UI to show after 3 seconds if nothing happens
setTimeout(() => {
    if(!currentView) {
        console.log('Force showing UI after timeout')
        showMainUI(null)
    }
}, 3000)

// Synchronous Listener
document.addEventListener('readystatechange', async () => {

    if (document.readyState === 'interactive' || document.readyState === 'complete'){
        if(rscShouldLoad){
            rscShouldLoad = false
            console.log('Document ready, showing UI for patcher mode')
            await showMainUI(null) // Skip distribution completely
        } 
    }

}, false)

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', async (event, res) => {
    // Patcher mode - ignore distribution and show UI immediately
    console.log('Distribution event received, showing UI for patcher mode')
    if(document.readyState === 'interactive' || document.readyState === 'complete'){
        await showMainUI(null) // Pass null since we don't need distribution data
    } else {
        rscShouldLoad = true
    }
})

// Util for development
async function devModeToggle() {
    DistroAPI.toggleDevMode(true)
    const data = await DistroAPI.refreshDistributionOrFallback()
    ensureJavaSettings(data)
    updateSelectedServer(data.servers[0])
    syncModConfigurations(data)
}

// Fonction pour l'effet de zoom du background
function startBackgroundZoom() {
    let zoomLevel = 100
    let zoomDirection = 1
    const zoomSpeed = 0.012
    const minZoom = 100
    const maxZoom = 110
    
    function animateZoom() {
        zoomLevel += zoomDirection * zoomSpeed
        
        if (zoomLevel >= maxZoom) {
            zoomLevel = maxZoom
            zoomDirection = -1
        } else if (zoomLevel <= minZoom) {
            zoomLevel = minZoom
            zoomDirection = 1
        }
        
        document.body.style.backgroundSize = `${zoomLevel}%`
        requestAnimationFrame(animateZoom)
    }
    
    // Démarrer l'animation
    animateZoom()
}

// Fonction pour l'effet de lueur animé du background
function startBackgroundGlow() {
    // Créer un élément overlay pour l'effet de lueur
    const glowOverlay = document.createElement('div')
    glowOverlay.id = 'backgroundGlowOverlay'
    glowOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        background: radial-gradient(circle at center, transparent 0%, rgba(102, 126, 234, 0.1) 50%, rgba(102, 126, 234, 0.2) 100%);
        animation: backgroundGlow 10s ease-in-out infinite;
    `
    
    // Ajouter l'overlay au body
    document.body.appendChild(glowOverlay)
    
    // Ajouter les styles CSS pour l'animation
    if (!document.getElementById('backgroundGlowStyles')) {
        const style = document.createElement('style')
        style.id = 'backgroundGlowStyles'
        style.textContent = `
            @keyframes backgroundGlow {
                0%, 100% {
                    opacity: 0.3;
                    transform: scale(1);
                    filter: blur(0px);
                }
                25% {
                    opacity: 0.6;
                    transform: scale(1.05);
                    filter: blur(1px);
                }
                50% {
                    opacity: 0.8;
                    transform: scale(1.45);
                    filter: blur(2px);
                }
                75% {
                    opacity: 0.6;
                    transform: scale(1.05);
                    filter: blur(1px);
                }
            }
            
            #backgroundGlowOverlay {
                background: radial-gradient(circle at center, transparent 0%, rgba(102, 126, 234, 0.2) 40%, rgba(102, 126, 234, 0.5) 70%, rgba(102, 126, 234, 0.25) 100%);
            }
        `
        document.head.appendChild(style)
    }
}

// Export functions globally so they can be used in other scripts
window.switchView = switchView
window.getCurrentView = getCurrentView
window.VIEWS = VIEWS
