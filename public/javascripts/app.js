"use strict"

import {TodoManager, 
        TodoList, 
        Todo, 
        DatabasePersistence, 
        Modal, 
        Nav} from './todo_manager.js'

class App {
  constructor() {
    this.configureTemplates();
    this.storage = new DatabasePersistence();
    this.storage.findAllTodos().then(todos => {
      this.todoList = new TodoList(todos);
      this.todoManager = new TodoManager(this.todoList);
      this.currentlyVisible = 'all';
      this.refreshTodoPage();
      this.nav = new Nav(document.querySelector('nav'), this.templates.navTemplate);
      this.bind();
      this.refreshNav();
    }); 
    this.modal = new Modal(document.getElementById('modal'));
  }

  configureTemplates() {
    this.registerTemplates();
    this.registerPartials();
    this.registerHelpers();
  }

  registerTemplates() {
    const templates = {};
    const sources = document.querySelectorAll('script[type="text/x-handlebars"]');
    sources.forEach(source => {
      templates[source.getAttribute('id')] = Handlebars.compile(source.innerHTML);
    });
    this.templates = templates;
  }

  registerPartials() {
    const sources = document.querySelectorAll('script[data-type="partial"]');
    sources.forEach(source => {
      Handlebars.registerPartial(source.getAttribute('id'), source.innerHTML);
    });
  }

  registerHelpers() {
    this.registerDueDateHelper();
    this.registerStringifyHelper();
  }

  registerDueDateHelper() {
    Handlebars.registerHelper('dueDate', function(todo) {
      if(todo.month && todo.year) {
        return `${todo.month}/${todo.year.slice(-2)}`;
      } else {
        return "No Due Date";
      }
    });
  }

  registerStringifyHelper() {
    Handlebars.registerHelper('stringify', function(todo) {
      return JSON.stringify(todo);
    });
  }

  refreshTodoPage() {
    const todos = this.findVisibleTodos()
    this.renderTodoList(todos);
    this.renderTodoCount(todos.length);
  }

  findVisibleTodos() {
    switch (this.currentlyVisible) {
      case 'all':
        return this.todoManager.allTodos();
        break;
      case 'completed':
        return this.todoManager.completedTodos();
        break;
      default:
        return this.findDateRestrictedTodos();
        break;
    }
  }

  renderTodoList(todos) {
    const html = this.templates.todoItems({ todos: todos });
    document.getElementById('todoList').innerHTML = html;
  }

  renderTodoCount(count) {
    document.querySelector('span.active-todos').textContent = count;
  }

  findDateRestrictedTodos() {
    const visible = this.currentlyVisible;
    if(this.nav.activeSection === 'all') {
      return this.todoManager.todosInMonthYear(visible.month, visible.year);
    } else {
      return this.todoManager.completedTodosInMonthYear(visible.month, visible.year);
    }
  }

  bind() {
    document.getElementById('todoPage').onclick = this.handleTodoPageClick.bind(this);
    document.onclick = this.handleDocumentClick.bind(this);
    this.modal.node.onsubmit = this.handleModalSubmit.bind(this);
    this.modal.node.onclick = this.handleModalClick.bind(this);
    this.nav.node.onclick = this.handleNavClick.bind(this);
  }

  handleTodoPageClick(event) {
    switch (event.target.tagName) {
      case 'A':
        this.handleAnchorClick(event);
        break;
      case 'DIV':
      case 'SPAN':
        this.toggleTodo(event.target.getAttribute('data-id'));
        break;
      case 'LABEL':
        event.stopPropagation();
        this.showModalFor(event.target.getAttribute('data-todo'));
        break;
    }
  }

  handleDocumentClick(event) {
    switch (event.target.tagName) {
      case 'FORM':
        this.handleFormClick(event);
        break;
    }
  }

  handleModalSubmit(event) {
    event.preventDefault();
    const input = document.querySelector('input[name="title"]');
    if (input.value.length < 3) {
      alert("The title must have at least three characters");
      return;
    }
    let props;
    switch (event.target.getAttribute('data-action')) {
      case 'add':
        props = this.extractTodoProps(event.target);
        this.addTodo(props);
        break;
      case 'update':
        props = this.extractTodoProps(event.target);
        this.updateTodo(this.modal.id(), props);
        this.modal.reset();
    }
  }

  handleNavClick(event) {
    event.preventDefault();
    
    let currentNode = event.target;
    while (currentNode.tagName != 'A' && currentNode.parentNode != null) {
      currentNode = currentNode.parentNode;
    }
    
    if(currentNode.tagName === 'A') {
      this.nav.removeHighlights();
      this.nav.activeSection = currentNode.parentNode.getAttribute('data-section');
      this.nav.highlighted = currentNode.getAttribute('data-title');
      const visibility = currentNode.getAttribute('data-visibility');
      const title = currentNode.getAttribute('data-title');
      if (typeof visibility === "string") {
        this.currentlyVisible = visibility 
      } else {
        this.currentlyVisible = this.extractSearchCriteria(currentNode);
      }
      this.nav.highlight()
      this.setHeading(title);
      this.refreshTodoPage();
    }
  }

  handleAnchorClick(event) {
    event.preventDefault();
    const a = event.target;
    switch (a.getAttribute('data-action')) {
      case "newTodo":
        this.modal.show();
        break;
      case "deleteTodo":
        const id = a.getAttribute('data-id');
        this.deleteTodo(id);
        break;
    }
  }

  handleFormClick(event) {
    if(event.target.className.includes('modal')) {
      event.preventDefault();
      this.modal.reset();
    }
  }

  handleModalClick(event) {
    if (event.target.getAttribute('name') === "completed") {
      if (this.modal.completed() === "false") {
        const id = this.modal.id();
        this.updateTodo(id, {completed: true});
      } else if (this.modal.isForNewTodo()) {
        alert("Cannot mark as complete as item has not been created yet!");
      } else {
        this.modal.reset();
      }
    }
  }

  addTodo(props) {
    this.storage.add(props)
                .then(todo => {
                  this.todoList.addTodo(todo);
                  this.modal.reset();
                  this.currentlyVisible = 'all';
                  this.refreshTodoPage();
                  this.nav.resetHighlight();
                  this.refreshNav();
                })
                .catch(message => console.error(message));
  }
  
  deleteTodo(id) {
    this.storage.deleteTodo(id).then(() => {
                                  this.todoList.deleteTodo(+id);
                                  this.refreshTodoPage();
                                  this.refreshNav();
                                });
  }

  toggleTodo(id) {
    this.storage.toggleTodo(id)
                .then((todo) => {
                  this.todoList.update(+id, todo);
                  this.refreshTodoPage();
                  this.refreshNav();
                })
                .catch(message => console.error(message));
  }
  
  updateTodo(id, props) {
    this.storage.update(id, props)
                .then(todo => {
                  this.todoList.update(+id, todo);
                  this.modal.reset();
                  this.refreshTodoPage();
                  this.refreshNav();
                })
                .catch(message => console.error(message));
  }

  showModalFor(todo) {
    todo = JSON.parse(todo);
    this.modal.update(todo);
    this.modal.show();
  }

  setHeading(newHeading) {
    document.querySelector('#todoPage h1').firstChild.textContent = newHeading;
  }

  refreshNav() {
    const allTodos = this.todoManager.allTodos();
    const completedTodos = this.todoManager.completedTodos();
    const todos = this.findUniquelyDated(allTodos);
    this.nav.refresh(todos);
    this.nav.dateListItems().forEach(li => this.updateCount(li));
    this.nav.updateAllTodosCounter(allTodos.length);
    this.nav.updateCompletedTodosCounter(completedTodos.length);
    this.nav.highlight();
  }

  updateCount(li) {
    const searchCriteria = this.extractSearchCriteria(li.firstElementChild);
    const matching = this.todoList.matchingTodos(searchCriteria);
    const count = li.querySelector('dd');
    count.textContent = matching.length;
  }
  
  extractSearchCriteria(node) {
    const year = node.getAttribute('data-year') || null;
    const month = node.getAttribute('data-month') || null;
    const completed = node.getAttribute('data-completed');
    const searchCriteria = { month: month, year: year };
    if (completed === "true")  {
      searchCriteria['completed'] = true;
    } 
    return searchCriteria;
  }

  extractTodoProps(form) {
    const props = {};
    const formData = new FormData(form);
    for(var pair of formData.entries()) {
      props[pair[0]] = pair[1];
    }

    return props;
  }

  findUniquelyDated(todos) {
    function byDate(currentTodo, nextTodo) {
      if (+currentTodo.year === +nextTodo.year) {
        return +currentTodo.month - +nextTodo.month; 
      } else {
        return +currentTodo.year - +nextTodo.year;
      }
    }

    const uniquelyDated = [];
    todos.forEach(todo => {
      let seen = uniquelyDated.filter(uniqueTodo => {
        return todo.year === uniqueTodo.year &&
               todo.month === uniqueTodo.month;
      });
      if (seen.length > 0) {
        if (!seen[0].completed) {
          uniquelyDated.splice(uniquelyDated.indexOf(seen[0]), 1);
          uniquelyDated.push(todo);
        }
      } else {
        uniquelyDated.push(todo);
      }
    });
    return uniquelyDated.sort(byDate);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  new App();
})