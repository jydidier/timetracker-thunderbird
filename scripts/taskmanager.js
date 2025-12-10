/** this class should manage all that is related to tasks */

import * as JCAL from './jcal.js';

class TaskManager extends EventTarget {
    #tasks = new Map();
    #taskTree = new Map();
    #calId = null;
    #calendarManager;

    constructor() {
        //this.refreshAllTasks(items);
    }

    setCalendarManager(cm) {
        this.#calendarManager = cm;
    }

    initTask(obj) {


    }

    startTask(uid) {


    }

    stopTask(uid) {

    }


    updateTask(uid, obj) {
        let task = this.#tasks.get(uid);
        Object.apply(task,obj);
        if (task === undefined) 
            return;

        this.#emitUpdated(task);
    }


    deleteTask(uid) {
        let task = this.#tasks.get(uid);
        if (task === undefined)
            return ;

        task.timeSlices.forEach((item) => {
            this.#emitDeleted(item);
        });
        task.children.forEach((item) => {
            deleteTask(item)
        });

        this.#emitDeleted(task);
    }

    getElapsedTime(uid) {
        let task = this.#tasks.get(uid);
        if (!task)
            return;

        let duration = 0;
        task.timeSlices.forEach((item) => {
            if (item !== null) {
                duration += new Date(item.due) - new Date(item.dtstart);
            }
        });

        task.children.forEach((item) => {
            if (item !== null)
                duration += getElapsedTime(item);
        });
        return duration;
    }


    asTodo(item) {
        if (item.formats){
            const cmp = new JCAL.Component(item.formats.jcal);
            return cmp.first('vtodo');
        }
        if (item.format === 'jcal') {
            const cmp = new JCAL.Component(item.item);
            return cmp.first('vtodo');
        }
        return null;
    }


    async refreshAllTasks() {
        if (!cm) return ;
        const taskStack = [];
        this.#taskTree.clear();
        this.#tasks.clear();

        let items = await cm.getTasks();

        items.forEach(item => {
            let todo = this.asTodo(item);
            todo.children = new Map();
            todo.timeSlices = new Map();                                                                 
            tasks.set(todo.uid, todo);

            if (todo.relatedTo || todo.xIcanbanParent) {
                todoStack.push(todo);
            } else {
                taskTree.set(todo.uid, todo);
            }

            todoStack.forEach(elt => {
                if (elt.relatedTo || elt.xIcanbanParent) {
                    if (elt.status === 'NEEDS-ACTION') {
                        tasks.get(elt.relatedTo ?? elt.xIcanbanParent)
                            .children.set(elt.uid, elt);
                    } else {
                        tasks.get(elt.relatedTo ?? elt.xIcanbanParent)
                            .timeSlices.set(elt.uid, elt);
                    }
                }
            });
        });
    }

    #getDate() {
        let date = new Date();
        return String(date.getFullYear()).padStart(4,"0") + "-" +
            String(date.getMonth()).padStart(2,"0") + "-" +
            String(date.getDate()).padStart(2,"0") + "T" +
            String(date.getHours()).padStart(2,"0") + ":" +
            String(date.getMinutes()).padStart(2,"0") + ":" +
            String(date.getSeconds()).padStart(2,"0");
    };

    #emitCreated(item) {
        this.dispatchEvent(new CustomEvent("create", { item }));
    }

    #emitUpdated(item) {
        this.dispatchEvent(new CustomEvent("update", { item }));
    }

    #emitDeleted(item) {
        this.dispatchEvent(new CustomEvent("delete", { item }));
    }

};

export {TaskManager};
