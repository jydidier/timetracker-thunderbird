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


if (timetrackerMenuItem === null) {
    console.log(browser.runtime.lastError);

};


browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === timetrackerMenuItem) {
    }
});

browser.action.onClicked.addListener(async (...args) => {
});
