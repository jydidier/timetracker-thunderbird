let timetrackerContext = await browser.contextualIdentities.create({
    "name": "timetracker",
    "color": "green",
    "icon": "tree"
});

let timetrackerMenuItem = await browser.menus.create({
        "id" : "timetrackerMenuItem",
        "title": browser.i18n.getMessage("menuItem"),
        "contexts": ["tools_menu"],
        "visible": true,
        "icons": {
        }
    }
);

let createBoard = async () => {
    let tab = await browser.tabs.query({ 
        "cookieStoreId": timetrackerContext.cookieStoreId,
    });

    if (tab.length ===0) {
        browser.tabs.create({
            "cookieStoreId": timetrackerContext.cookieStoreId,
            "url": "./ui/board.html"
        });
    } else {
        browser.tabs.update(tab[0].id, { active: true });
    }
};


if (timetrackerMenuItem === null) {
    console.log(browser.runtime.lastError);

};


browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === timetrackerMenuItem) {
        createBoard();
    }
});

browser.action.onClicked.addListener(async (...args) => {
    createBoard();
});
