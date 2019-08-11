
const fs = require("fs");
const path = require("path");
const trace = Editor.log;

var buildAssetsInfo = {};
buildAssetsInfo.buildResults = null;
buildAssetsInfo.spriteFrames = null;
buildAssetsInfo.textures = null;

function onBeforeBuildFinish(options, callback) {
    let buildResults = options.buildResults;
    buildAssetsInfo.buildResults = buildResults;
    buildAssetsInfo.spriteFrames = null;
    buildAssetsInfo.textures = null;
    // get path of textures auto generated by auto atlas
    Editor.assetdb.queryAssets('db://assets/**/*', 'sprite-frame', (err, assetInfos) => {
        //Editor.log(`sprite-frames: ${JSON.stringify(assetInfos,null,2)} `);
        buildAssetsInfo.spriteFrames = assetInfos;
        checkResData(callback);
        let textures = _getTextureFromSpriteFrames(buildResults, assetInfos);
        for (let i = 0; i < textures.length; ++i) {
            let path = buildResults.getNativeAssetPath(textures[i]);
            // Editor.log(`"resources/AutoAtlas": ${path} originpath ${textures[i]}`);
        }
    });

    // get texture path of plist atlas
    Editor.assetdb.queryAssets('db://assets/atlas.png', 'texture', (err, assetInfos) => {
        for (let i = 0; i < assetInfos.length; ++i) {
            let tex = assetInfos[i].uuid;
            if (buildResults.containsAsset(tex)) {
                let path = buildResults.getNativeAssetPath(tex);
                // Editor.log(`Texture of "${assetInfos[i].url}": ${path}`);
            }
        }
    });

    // get common texture path
    Editor.assetdb.queryAssets('db://assets/**/*', 'texture', (err, assetInfos) => {
        // Editor.log(`textures: ${JSON.stringify(assetInfos,null,2)} `);
        buildAssetsInfo.textures = {};

        for (let i = 0; i < assetInfos.length; ++i) {
            let tex = assetInfos[i].uuid;
            if (buildResults.containsAsset(tex)) {
                let path = buildResults.getNativeAssetPath(tex);
                buildAssetsInfo.textures[tex] = {
                    name: assetInfos[i].url.split("//")[1],
                    path: path
                };
                // Editor.log(`Texture of "${assetInfos[i].url}": ${path}`);
            }
        }

        checkResData(callback);

    });

    // get all textures in build
    let textures = [];
    let assets = buildResults.getAssetUuids();
    let textureType = cc.js._getClassId(cc.Texture2D);
    for (let i = 0; i < assets.length; ++i) {
        let asset = assets[i];
        if (buildResults.getAssetType(asset) === textureType) {
            textures.push(buildResults.getNativeAssetPath(asset));
        }
    }
    // Editor.log(`All textures in build: ${textures}`);
}

function _getTextureFromSpriteFrames(buildResults, assetInfos) {
    let textures = {};
    for (let i = 0; i < assetInfos.length; ++i) {
        let info = assetInfos[i];
        if (buildResults.containsAsset(info.uuid)) {
            let depends = buildResults.getDependencies(info.uuid);
            if (depends.length > 0) {
                // sprite frame should have only one texture
                textures[depends[0]] = true;
            }
        }
    }
    return Object.keys(textures);
}


function checkResData(callback) {
    if (!buildAssetsInfo.spriteFrames) {
        return;
    }
    if (!buildAssetsInfo.textures) {
        return;
    }
    trace(`buildAssetsInfo = ${JSON.stringify(buildAssetsInfo, null, 2)}`)
    // 解析buildresuts
    // 解析 dependUuids
    let dependUuidsInfos = {};
    let _buildAssets = buildAssetsInfo.buildResults["_buildAssets"];
    for (let k in _buildAssets) {
        let dependUuids = _buildAssets[k]["dependUuids"];
        if (dependUuids) {
            // trace(`dependUuids = ${JSON.stringify(dependUuids, null, 2)}`)
            for (let i = 0; i < dependUuids.length; i++) {
                let uuid = dependUuids[i];
                if (!dependUuidsInfos[uuid]) {
                    dependUuidsInfos[uuid] = [];
                }
                dependUuidsInfos[uuid].push(k);
            }
        }
    }
    // 剔除正常图片

    let getSprieFrameInfo = function (uuid) {
        for (let spf of buildAssetsInfo.spriteFrames) {
            if (spf.uuid === uuid) {
                return spf;
            }
        }
        return null;
    }
    // trace(`dependUuidsInfos = ${JSON.stringify(dependUuidsInfos, null, 2)}`)
    for (let uuid in dependUuidsInfos) {
        let hasDelete = false;
        for (const texId in buildAssetsInfo.textures) {
            if (texId === uuid) {
                delete dependUuidsInfos[uuid];
                hasDelete = true;
                break;
            }
        }
        if (hasDelete) {
            continue;
        }
        let dependFrames = dependUuidsInfos[uuid];
        let sameDirFile = [];
        for (let index = 0; index < dependFrames.length; index++) {
            let spf = getSprieFrameInfo(dependFrames[index]);
            if (spf) {
                sameDirFile.push(spf.url);
            }
        }
        if (sameDirFile.length > 0) {
            let imgFileName = ""
            if (sameDirFile.length > 1) {
                let endDir = "";
                for (let i = 3; i < 256; i++) {
                    let _char = sameDirFile[0][i];
                    let isSame = true;
                    for (let item of sameDirFile) {
                        if (item[i] !== _char) {
                            isSame = false;
                            break;
                        }
                    }
                    if (!isSame) {
                        endDir = sameDirFile[0].split('').splice(0, i).join('');
                        break;
                    }
                }
                endDir = endDir.split("//")[1];
                let ssss = endDir.split("/");
                ssss.pop();
                imgFileName = ssss.join("/")
            } else if (sameDirFile.length == 1) {
                trace(`注意：一张图片合图无意义，请修改配置 ${sameDirFile} ！！！！！！！！！！`);
                let endDir = sameDirFile[0].split("//")[1];
                let ffff = endDir.split("/");
                ffff.pop();
                ffff.pop();
                imgFileName = ffff.join("/")
            }
            // trace(`uuid= ${uuid}  imgFileName = ${imgFileName}`);
            buildAssetsInfo.textures[uuid] = {
                name: imgFileName,
                path: _buildAssets[uuid].nativePath
            }
        }
    }
    trace(`Editor.Project.path = ${Editor.Project.path}`)
    const jsonPath = path.join(Editor.Project.path, "$buildtexture.json");
    if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
    }
    trace(` 一共搜索出 ${Object.keys(buildAssetsInfo.textures).length} 张图片`);
    trace(` ${jsonPath} 图片名和路径映射 ${JSON.stringify(buildAssetsInfo.textures, null, 2)}`)
    //
    fs.writeFileSync(jsonPath, JSON.stringify(buildAssetsInfo.textures, null, 2));
    callback && callback();
}


module.exports = {
    load() {
        // Editor.Builder.on('before-change-files', onBeforeBuildFinish);
        Editor.Builder.on('build-finished', onBeforeBuildFinish);


    },

    unload() {
        // Editor.Builder.removeListener('before-change-files', onBeforeBuildFinish);
        Editor.Builder.removeListener('build-finished', onBeforeBuildFinish);

    }
};
