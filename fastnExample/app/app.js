var cpjax = require('cpjax'),
    lenze = require('../../')({
    changeInterval: 16,
    send: function(data){
        self.postMessage(data);
    },
    receive: function(callback){
        self.addEventListener('message', function(message){
            callback(message.data);
        });
    }
});

var state = lenze.state;

function updateUsers(){
    state.visibleUsers = state.users && state.users.filter(function(user){
        return ~user.name.indexOf(state.search);
    });
};

state.setSearch = function(value){
    state.search = value;
    updateUsers();
};

cpjax({
    url: 'users.json',
    dataType: 'json'
}, function(error, data){
    if(error){
        return;
    }

    state.users = data;
    updateUsers();
});