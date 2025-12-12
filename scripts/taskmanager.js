/** this class should manage all that is related to tasks */

import * as JCAL from './jcal.js';

class TaskManager extends EventTarget {
    #tasks = new Map();
    #taskTree = new Map();
    #calId = null;
    #calendarManager;
    #intervalId;

    constructor() { 
        super();
        this.#intervalId = 0;
    }

    setCalendarManager(cm) {
        this.#calendarManager = cm;
    }

    async startTask(uid) {
        this.stopTask(uid);
        let newTask = this.getTask();
        let parentTask = this.getTask(uid);

        await this.saveTask(newTask, {
            summary : parentTask.summary,
            status: 'IN-PROCESS',
            dtstart: this.#getDate(),
            due: this.#getDate(),
            relatedTo: uid,
            xIcanbanParent: uid,
            running: true
        });
    }

    setUpdateFrequency(f) {
        if (this.#intervalId) {
            clearInterval(this.#intervalId);
        } 

        if (parseInt(f) === -1) 
            return ; 

        const self = this;
        this.#intervalId = setInterval(() => {
            self.#tasks.forEach((item) => {
                if (item.running) {
                    self.saveTask(item, {
                        due: this.#getDate()
                    });
                }
            });
            self.#emitUpdate();
        }, parseInt(f));
    }

    async stopTask(uid) {
        this.#tasks.get(uid).timeSlices.forEach(async (item) => {
            if (item.running) {
                await this.saveTask(item, {
                    due: this.#getDate(),
                    status: 'COMPLETED',
                    running: false
                });
            }
        });
    }

    getTask(uid) {
        if (uid !== undefined && this.#tasks.has(uid))
            return this.#tasks.get(uid);
        else 
            return new JCAL.Todo();
    }

    async saveTask(task, updateObject) {
        if (updateObject !== undefined) 
            Object.assign(task, updateObject); 


        if (task.uid === null) {
            if (this.#calendarManager) {
                let result = await this.#calendarManager.createTask(task);
                task.uid = result;
            } else {
                return;
            }
        } else {
            if (this.#calendarManager) {
                await this.#calendarManager.updateTask(task);
            }
        }

        console.log({task});

        this.#tasks.set(task.uid, task);
        if (task.relatedTo ?? task.xIcanbanParent) {
            let parentTask = this.#tasks.get(task.relatedTo ?? task.xIcanbanParent);
            if (task.status !== 'NEEDS-ACTION') {
                parentTask.timeSlices.set(task.uid, task);
            } else {
                parentTask.children.set(task.uid, task);                        
            }
        } else {
            task.timeSlices = new Map();
            task.children = new Map();
            this.#taskTree.set(task.uid, task);
        }
    }



    updateTask(uid, obj) {
        let task = this.#tasks.get(uid);
        Object.assign(task,obj);
        if (task === undefined) 
            return;
        if (this.#calendarManager) this.#calendarManager.updateTask(task);
    }


    deleteTask(uid) {
        let task = this.#tasks.get(uid);
        if (task === undefined)
            return ;

        task.timeSlices.forEach((item) => {
            this.#tasks.delete(item.uid);
            if (this.#calendarManager) 
                this.#calendarManager.deleteTask(item.uid);
            //this.#emitDeleted(item);
        });
        task.children.forEach((item) => {
            deleteTask(item)
        });

        if (task.relatedTo ?? task.xIcanbanParent) {
            let parent = this.#tasks.get(task.relatedTo ?? task.xIcanbanParent);
            parent.children.delete(uid);
        } else {
            this.#taskTree.delete(uid);
        }

        this.#tasks.delete(uid);
        if (this.#calendarManager)
            this.#calendarManager.deleteTask(uid);
    }


    getElapsedTime(uid) {
        let self = this;
        let task = this.#tasks.get(uid);
        if (!task) return;

        let duration = 0;
        task.timeSlices.forEach((item) => {
            if (item.running) {
                duration += new Date(this.#getDate()) - new Date(item.dtstart);
            } else {
                duration += new Date(item.due) - new Date(item.dtstart);
            }
        });

        task.children.forEach((item) => {
            duration += this.getElapsedTime(item.uid);
        });
        return duration;
    }

    getTaskMap() {
        return this.#taskTree;
    }

    getTasks() {
        return this.#tasks;
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
        if (!this.#calendarManager) return ;
        const todoStack = [];
        this.#taskTree.clear();
        this.#tasks.clear();

        let items = await this.#calendarManager.getTasks();

        items.forEach(item => {
            let todo = this.asTodo(item);
            todo.children = new Map();
            todo.timeSlices = new Map();                                                                 
            this.#tasks.set(todo.uid, todo);

            if (todo.relatedTo || todo.xIcanbanParent) {
                todoStack.push(todo);
            } else {
                this.#taskTree.set(todo.uid, todo);
            }
        });

        todoStack.forEach(elt => {
            if (elt.relatedTo || elt.xIcanbanParent) {
                if (elt.status === 'NEEDS-ACTION') {
                    this.#tasks.get(elt.relatedTo ?? elt.xIcanbanParent)
                        .children.set(elt.uid, elt);
                } else {
                    this.#tasks.get(elt.relatedTo ?? elt.xIcanbanParent)
                        .timeSlices.set(elt.uid, elt);
                }
            }
        });
        //});

        console.log(this.#tasks, this.#taskTree);
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

    #emitUpdate() {
        this.dispatchEvent(new CustomEvent("update"));
    }

};

export {TaskManager};
