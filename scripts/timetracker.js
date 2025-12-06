/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** TODO Organize extension in a more modular way */

import './i18n.js';

import * as JCAL from './jcal.js';
import {marked} from '../vendor/marked.esm.js';



/* helper functions */
let setStorage = async (key, value) => {
    if( globalThis.browser !== undefined) {
        let obj = {};
        obj[key] = value;
        await browser.storage.local.set(obj);
    } else {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

let getStorage = async (key) => {
    if (globalThis.browser !== undefined) {
        let obj = await browser.storage.local.get(key);
        return obj[key];
    } else {
        return JSON.parse(localStorage.getItem(key));
    }
};

const asTodo = (item) => {
    if (item.formats){
        const cmp = new JCAL.Component(item.formats.jcal);
        return cmp.first('vtodo');
    }
    if (item.format === 'jcal') {
        const cmp = new JCAL.Component(item.item);
        return cmp.first('vtodo');
    }
    return null;
};


/* Modal setup for task edition */
const taskModal = document.getElementById('taskModal');
const saveTaskButton = document.getElementById('saveTask');

const saveTask = async (evt) => {
    //  here, we must add some controls
    let form = document.getElementById('taskForm');
    if (!form.checkValidity()) {
        evt.preventDefault();
        evt.stopPropagation();
        alert(browser.i18n.getMessage('alertTask'));
        return;
    }

    let title = document.getElementById('taskTitle').value;
    let description = document.getElementById('taskDescription').value;

    let item = (id !== "null") ?
        asTodo(await mc.items.get(calendarId, id, { returnFormat: "jcal" })) :
        new JCAL.Todo();
    if (title !== item.summary)
        item.summary = title;
    if (description !== item.description)
        item.description = description;

    if (id !== "null") {
        item.uid = id;
        await mc.items.update(calendarId, id, {format: 'jcal', item: item.data});

        if (calendarId !== newCalendarId) {
            await mc.items.move(calendarId, newCalendarId, id);
        }
    } else {
        item.type="task";
        await mc.items.create(newCalendarId, {type: 'task', format: 'jcal', item: item.data});
    }
    let modal = bootstrap.Modal.getInstance(document.getElementById("taskModal"));
    modal.hide();
}



