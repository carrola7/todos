"use strict"

class App {
  constructor() {
    this.configureTemplates();
    this.storage = new DatabasePersistence();
    this.storage.findAllTodos().then(todos => {
      this.todoList = new TodoList(todos);
      this.todoManager = new TodoManager(this.todoList);
      this.renderPage();
    }); 
    this.newTodoModal = this.createNewTodoModal();
    this.todoListElement = document.getElementById('todoList'); 

    this.bind();
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

  renderPage() {
    this.renderTodoList();
    this.renderTotalTodos();
  }

  renderTodoList() {
    const html = this.templates.todoItems({ todos: this.todoManager.allTodos() });
    this.todoListElement.innerHTML = html;
  }

  renderTotalTodos() {
    document.querySelector('span.active-todos').textContent = this.todoManager.allTodos().length
  }

  createNewTodoModal() {
    const holder = document.createElement('div');
    holder.innerHTML = this.templates.modal({});
    const modal = holder.firstElementChild;
    modal.setAttribute('data-action', 'add');
    modal.classList.add('hidden');
    document.querySelector('main').appendChild(modal);
    return modal;
  }

  bind() {
    document.getElementById('todoPage').onclick = this.handleTodoPageClick.bind(this);
    document.onclick = this.handleDocumentClick.bind(this);
    this.newTodoModal.onsubmit = this.handleModalSubmit.bind(this);
    this.newTodoModal.onclick = this.handleModalClick.bind(this);
  }

  handleTodoPageClick(event) {
    console.log(event.target.tagName);
    switch (event.target.tagName) {
      case 'A':
        this.handleAnchorClick(event);
        break;
      case 'DIV':
      case 'SPAN':
        this.toggleTodo(event.target.getAttribute('data-id'));
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

  handleAnchorClick(event) {
    event.preventDefault();
    const a = event.target;
    switch (a.getAttribute('data-action')) {
      case "newTodo":
        this.newTodoModal.classList.remove('hidden');
        break;
      case "deleteTodo":
        const id = a.getAttribute('data-id');
        this.storage.deleteTodo(id).then(() => {
                                      this.todoList.deleteTodo(+id)
                                      this.renderPage()
                                    });
                                    
        break;
    }
  }

  toggleTodo(id) {
    this.storage.toggleTodo(id)
                .then((todo) => {
                  this.todoList.update(+id, todo);
                  this.renderPage();
                })
                .catch(message => console.error(message));

  }

  handleFormClick(event) {
    if(event.target.className.includes('modal')) {
      event.preventDefault();
      event.target.classList.add('hidden');
    }
  }

  handleModalSubmit(event) {
    event.preventDefault();
    const input = document.querySelector('input[name="title"]');
    if (input.value.length < 3) {
      alert("The title must have at least three characters");
      return;
    }
    switch (event.target.getAttribute('data-action')) {
      case 'add':
        const props = this.extractTodoProps(event.target);
        this.addTodo(props);
        event.target.classList.add('hidden');
        break;
    }
  }

  handleModalClick(event) {
    if (event.target.getAttribute('name') === "completed") {
      alert("Cannot mark as complete as item has not been created yet!")
    }
  }

  extractTodoProps(form) {
    const props = {};
    const formData = new FormData(form);
    for(var pair of formData.entries()) {
      props[pair[0]] = pair[1];
    }

    return props
  }

  addTodo(props) {
    this.storage.add(props)
                .then(todo => {
                  this.todoList.addTodo(todo);
                  this.renderPage();
                });
  }
}

var app;
document.addEventListener('DOMContentLoaded', function() {
  app = new App();
})